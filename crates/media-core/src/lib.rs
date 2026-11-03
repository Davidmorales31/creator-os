use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const MEDIA_CATALOG_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Video,
    Audio,
    Image,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbedMedia {
    pub kind: MediaKind,
    pub file_size_bytes: u64,
    pub duration_seconds: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAsset {
    pub id: String,
    pub file_name: String,
    pub source_path: String,
    pub kind: MediaKind,
    pub file_size_bytes: u64,
    pub duration_seconds: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub imported_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCatalog {
    pub schema_version: u32,
    pub assets: Vec<MediaAsset>,
}

impl Default for MediaCatalog {
    fn default() -> Self {
        Self {
            schema_version: MEDIA_CATALOG_SCHEMA_VERSION,
            assets: Vec::new(),
        }
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum MediaValidationError {
    #[error("media asset id cannot be empty")]
    EmptyId,
    #[error("media file name cannot be empty")]
    EmptyFileName,
    #[error("media source path cannot be empty")]
    EmptySourcePath,
}

impl MediaAsset {
    pub fn from_probe(
        id: impl Into<String>,
        file_name: impl Into<String>,
        source_path: impl Into<String>,
        imported_at: impl Into<String>,
        probe: ProbedMedia,
    ) -> Result<Self, MediaValidationError> {
        let id = id.into();
        let file_name = file_name.into();
        let source_path = source_path.into();

        if id.trim().is_empty() {
            return Err(MediaValidationError::EmptyId);
        }
        if file_name.trim().is_empty() {
            return Err(MediaValidationError::EmptyFileName);
        }
        if source_path.trim().is_empty() {
            return Err(MediaValidationError::EmptySourcePath);
        }

        Ok(Self {
            id,
            file_name,
            source_path,
            kind: probe.kind,
            file_size_bytes: probe.file_size_bytes,
            duration_seconds: probe.duration_seconds,
            width: probe.width,
            height: probe.height,
            fps: probe.fps,
            video_codec: probe.video_codec,
            audio_codec: probe.audio_codec,
            sample_rate: probe.sample_rate,
            channels: probe.channels,
            imported_at: imported_at.into(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn video_probe() -> ProbedMedia {
        ProbedMedia {
            kind: MediaKind::Video,
            file_size_bytes: 1_500_000,
            duration_seconds: Some(42.5),
            width: Some(1920),
            height: Some(1080),
            fps: Some(29.97),
            video_codec: Some("h264".into()),
            audio_codec: Some("aac".into()),
            sample_rate: Some(48_000),
            channels: Some(2),
        }
    }

    #[test]
    fn maps_probe_metadata_into_asset() {
        let asset = MediaAsset::from_probe(
            "asset-1",
            "clip.mp4",
            "/media/clip.mp4",
            "2026-11-03T10:00:00Z",
            video_probe(),
        )
        .expect("asset should be valid");

        assert_eq!(asset.kind, MediaKind::Video);
        assert_eq!(asset.width, Some(1920));
        assert_eq!(asset.height, Some(1080));
        assert_eq!(asset.video_codec.as_deref(), Some("h264"));
        assert_eq!(asset.audio_codec.as_deref(), Some("aac"));
    }

    #[test]
    fn rejects_empty_source_paths() {
        let error = MediaAsset::from_probe(
            "asset-1",
            "clip.mp4",
            "   ",
            "2026-11-03T10:00:00Z",
            video_probe(),
        )
        .expect_err("blank source path must fail");

        assert_eq!(error, MediaValidationError::EmptySourcePath);
    }

    #[test]
    fn catalog_is_explicitly_versioned() {
        let catalog = MediaCatalog::default();
        assert_eq!(catalog.schema_version, MEDIA_CATALOG_SCHEMA_VERSION);
        assert!(catalog.assets.is_empty());
    }
}
