use std::{
    env,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

use chrono::Utc;
use creator_os_media_core::{
    MediaAsset, MediaCatalog, MediaKind, MediaValidationError, ProbedMedia,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const PROJECTS_DIR: &str = "projects";
const PROJECT_FILE: &str = "project.json";
const MEDIA_DIR: &str = "media";
const MEDIA_INDEX_FILE: &str = "index.json";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCommandError {
    pub code: &'static str,
    pub message: String,
}

impl MediaCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<std::io::Error> for MediaCommandError {
    fn from(error: std::io::Error) -> Self {
        Self::new("io_error", error.to_string())
    }
}

impl From<serde_json::Error> for MediaCommandError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("invalid_media_metadata", error.to_string())
    }
}

impl From<MediaValidationError> for MediaCommandError {
    fn from(error: MediaValidationError) -> Self {
        Self::new("invalid_media_asset", error.to_string())
    }
}

pub struct FsMediaRepository {
    projects_root: PathBuf,
}

impl FsMediaRepository {
    pub fn from_app(app: &AppHandle) -> Result<Self, MediaCommandError> {
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|error| MediaCommandError::new("app_data_unavailable", error.to_string()))?;

        Ok(Self {
            projects_root: app_data.join(PROJECTS_DIR),
        })
    }

    pub fn import(&self, project_id: &str, source_path: &str) -> Result<MediaAsset, MediaCommandError> {
        let project_id = validate_project_id(project_id)?;
        self.ensure_project_exists(&project_id)?;

        let source = PathBuf::from(source_path);
        if !source.exists() {
            return Err(MediaCommandError::new(
                "media_not_found",
                format!("Media file was not found: {}", source.display()),
            ));
        }
        if !source.is_file() {
            return Err(MediaCommandError::new(
                "not_a_file",
                format!("Selected path is not a file: {}", source.display()),
            ));
        }

        let canonical = source.canonicalize()?;
        let canonical_string = canonical.to_string_lossy().into_owned();
        let mut catalog = self.load_catalog(&project_id)?;

        if let Some(existing) = catalog
            .assets
            .iter()
            .find(|asset| asset.source_path == canonical_string)
        {
            return Ok(existing.clone());
        }

        let probe = FfprobeMediaProbe::probe(&canonical)?;
        let file_name = canonical
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .ok_or_else(|| MediaCommandError::new("invalid_media_path", "Media path has no file name"))?;

        let asset = MediaAsset::from_probe(
            Uuid::new_v4().to_string(),
            file_name,
            canonical_string,
            Utc::now().to_rfc3339(),
            probe,
        )?;

        catalog.assets.push(asset.clone());
        catalog
            .assets
            .sort_by(|a, b| b.imported_at.cmp(&a.imported_at));
        self.save_catalog(&project_id, &catalog)?;
        Ok(asset)
    }

    pub fn list(&self, project_id: &str) -> Result<Vec<MediaAsset>, MediaCommandError> {
        let project_id = validate_project_id(project_id)?;
        self.ensure_project_exists(&project_id)?;
        Ok(self.load_catalog(&project_id)?.assets)
    }

    fn ensure_project_exists(&self, project_id: &str) -> Result<(), MediaCommandError> {
        let manifest = self.projects_root.join(project_id).join(PROJECT_FILE);
        if manifest.exists() {
            return Ok(());
        }

        Err(MediaCommandError::new(
            "project_not_found",
            format!("Project {project_id} was not found"),
        ))
    }

    fn load_catalog(&self, project_id: &str) -> Result<MediaCatalog, MediaCommandError> {
        let path = self.catalog_path(project_id);
        if !path.exists() {
            return Ok(MediaCatalog::default());
        }

        let raw = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&raw)?)
    }

    fn save_catalog(&self, project_id: &str, catalog: &MediaCatalog) -> Result<(), MediaCommandError> {
        let media_dir = self.projects_root.join(project_id).join(MEDIA_DIR);
        fs::create_dir_all(&media_dir)?;

        let target = media_dir.join(MEDIA_INDEX_FILE);
        let temporary = media_dir.join("index.json.tmp");
        fs::write(&temporary, serde_json::to_string_pretty(catalog)?)?;
        replace_file(&temporary, &target)?;
        Ok(())
    }

    fn catalog_path(&self, project_id: &str) -> PathBuf {
        self.projects_root
            .join(project_id)
            .join(MEDIA_DIR)
            .join(MEDIA_INDEX_FILE)
    }
}

fn validate_project_id(project_id: &str) -> Result<String, MediaCommandError> {
    Uuid::parse_str(project_id)
        .map(|id| id.to_string())
        .map_err(|_| MediaCommandError::new("invalid_project_id", "Project id is not a valid UUID"))
}

fn replace_file(temporary: &Path, target: &Path) -> Result<(), std::io::Error> {
    #[cfg(windows)]
    if target.exists() {
        fs::remove_file(target)?;
    }

    fs::rename(temporary, target)
}

struct FfprobeMediaProbe;

impl FfprobeMediaProbe {
    fn probe(path: &Path) -> Result<ProbedMedia, MediaCommandError> {
        let executable = env::var("CREATOR_OS_FFPROBE_PATH").unwrap_or_else(|_| "ffprobe".into());
        let output = Command::new(&executable)
            .args([
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
            ])
            .arg(path)
            .output()
            .map_err(|error| {
                if error.kind() == std::io::ErrorKind::NotFound {
                    MediaCommandError::new(
                        "ffprobe_unavailable",
                        "FFprobe was not found. Install FFmpeg or set CREATOR_OS_FFPROBE_PATH.",
                    )
                } else {
                    MediaCommandError::new("media_probe_failed", error.to_string())
                }
            })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            return Err(MediaCommandError::new(
                "media_probe_failed",
                if stderr.is_empty() {
                    "FFprobe could not read the selected media".to_owned()
                } else {
                    stderr
                },
            ));
        }

        let raw = String::from_utf8_lossy(&output.stdout);
        parse_ffprobe_output(path, fs::metadata(path)?.len(), &raw)
    }
}

#[derive(Debug, Deserialize)]
struct RawProbe {
    #[serde(default)]
    streams: Vec<RawStream>,
    format: Option<RawFormat>,
}

#[derive(Debug, Deserialize)]
struct RawFormat {
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    r_frame_rate: Option<String>,
    duration: Option<String>,
    sample_rate: Option<String>,
    channels: Option<u32>,
}

fn parse_ffprobe_output(
    path: &Path,
    file_size_bytes: u64,
    raw: &str,
) -> Result<ProbedMedia, MediaCommandError> {
    let probe: RawProbe = serde_json::from_str(raw)?;
    let video = probe
        .streams
        .iter()
        .find(|stream| stream.codec_type.as_deref() == Some("video"));
    let audio = probe
        .streams
        .iter()
        .find(|stream| stream.codec_type.as_deref() == Some("audio"));

    let image_extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .is_some_and(|value| {
            matches!(
                value.as_str(),
                "jpg" | "jpeg" | "png" | "webp" | "bmp" | "tif" | "tiff" | "avif" | "heic"
            )
        });

    let kind = if image_extension && video.is_some() {
        MediaKind::Image
    } else if video.is_some() {
        MediaKind::Video
    } else if audio.is_some() {
        MediaKind::Audio
    } else {
        return Err(MediaCommandError::new(
            "unsupported_media",
            "No supported audio, video, or image stream was found",
        ));
    };

    let duration_seconds = probe
        .format
        .as_ref()
        .and_then(|format| parse_decimal(format.duration.as_deref()))
        .or_else(|| {
            video
                .and_then(|stream| parse_decimal(stream.duration.as_deref()))
                .or_else(|| audio.and_then(|stream| parse_decimal(stream.duration.as_deref())))
        })
        .filter(|duration| *duration > 0.0 && kind != MediaKind::Image);

    Ok(ProbedMedia {
        kind,
        file_size_bytes,
        duration_seconds,
        width: video.and_then(|stream| stream.width),
        height: video.and_then(|stream| stream.height),
        fps: if kind == MediaKind::Video {
            video.and_then(|stream| parse_fraction(stream.r_frame_rate.as_deref()))
        } else {
            None
        },
        video_codec: video.and_then(|stream| stream.codec_name.clone()),
        audio_codec: audio.and_then(|stream| stream.codec_name.clone()),
        sample_rate: audio.and_then(|stream| {
            stream
                .sample_rate
                .as_deref()
                .and_then(|value| value.parse::<u32>().ok())
        }),
        channels: audio.and_then(|stream| stream.channels),
    })
}

fn parse_decimal(value: Option<&str>) -> Option<f64> {
    value?.parse::<f64>().ok().filter(|value| value.is_finite())
}

fn parse_fraction(value: Option<&str>) -> Option<f64> {
    let value = value?;
    let (numerator, denominator) = value.split_once('/')?;
    let numerator = numerator.parse::<f64>().ok()?;
    let denominator = denominator.parse::<f64>().ok()?;
    if denominator == 0.0 {
        return None;
    }
    let result = numerator / denominator;
    result.is_finite().then_some(result)
}

#[tauri::command]
pub fn import_media(
    app: AppHandle,
    project_id: String,
    source_path: String,
) -> Result<MediaAsset, MediaCommandError> {
    FsMediaRepository::from_app(&app)?.import(&project_id, &source_path)
}

#[tauri::command]
pub fn list_project_media(
    app: AppHandle,
    project_id: String,
) -> Result<Vec<MediaAsset>, MediaCommandError> {
    FsMediaRepository::from_app(&app)?.list(&project_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_video_probe_metadata() {
        let raw = r#"{
          "streams": [
            {"codec_type":"video","codec_name":"h264","width":1920,"height":1080,"r_frame_rate":"30000/1001"},
            {"codec_type":"audio","codec_name":"aac","sample_rate":"48000","channels":2}
          ],
          "format": {"duration":"12.500"}
        }"#;

        let probe = parse_ffprobe_output(Path::new("movie.mp4"), 1234, raw)
            .expect("valid ffprobe output should map");

        assert_eq!(probe.kind, MediaKind::Video);
        assert_eq!(probe.width, Some(1920));
        assert_eq!(probe.height, Some(1080));
        assert!((probe.fps.expect("fps") - 29.970).abs() < 0.01);
        assert_eq!(probe.audio_codec.as_deref(), Some("aac"));
        assert_eq!(probe.sample_rate, Some(48_000));
    }

    #[test]
    fn maps_image_without_treating_it_as_timed_video() {
        let raw = r#"{
          "streams": [
            {"codec_type":"video","codec_name":"png","width":1280,"height":720,"r_frame_rate":"25/1"}
          ],
          "format": {"duration":"0.040"}
        }"#;

        let probe = parse_ffprobe_output(Path::new("thumbnail.png"), 100, raw)
            .expect("image should map");

        assert_eq!(probe.kind, MediaKind::Image);
        assert_eq!(probe.duration_seconds, None);
        assert_eq!(probe.fps, None);
    }

    #[test]
    fn rejects_probe_output_without_supported_streams() {
        let error = parse_ffprobe_output(Path::new("data.bin"), 10, r#"{"streams":[]}"#)
            .expect_err("unsupported media should fail");

        assert_eq!(error.code, "unsupported_media");
    }

    #[test]
    fn ignores_invalid_frame_rate_fraction() {
        assert_eq!(parse_fraction(Some("0/0")), None);
        assert_eq!(parse_fraction(Some("invalid")), None);
    }
}
