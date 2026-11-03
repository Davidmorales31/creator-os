use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
};

use creator_os_transcript_core::{render_subtitles, SubtitleFormat};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

use crate::transcription_jobs::list_transcripts;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleExportResult {
    pub transcript_id: String,
    pub format: SubtitleFormat,
    pub output_path: String,
    pub bytes_written: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleCommandError {
    pub code: &'static str,
    pub message: String,
}

impl SubtitleCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

fn save_subtitles(path: &PathBuf, data: &str) -> Result<(), SubtitleCommandError> {
    let temporary = path.with_extension("partial");
    let result = (|| -> std::io::Result<()> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary)?;
        file.write_all(data.as_bytes())?;
        file.sync_all()?;
        // The final name is a fresh UUID under a validated app-owned project folder.
        fs::rename(&temporary, path)
    })();
    if result.is_err() { let _ = fs::remove_file(&temporary); }
    result.map_err(|error| SubtitleCommandError::new("subtitle_io_error", error.to_string()))
}

#[tauri::command]
pub fn export_subtitles(
    app: AppHandle,
    project_id: String,
    asset_id: String,
    transcript_id: String,
    format: SubtitleFormat,
) -> Result<SubtitleExportResult, SubtitleCommandError> {
    let project_uuid = Uuid::parse_str(&project_id)
        .map_err(|_| SubtitleCommandError::new("invalid_project_id", "Invalid project ID"))?;
    let asset_uuid = Uuid::parse_str(&asset_id)
        .map_err(|_| SubtitleCommandError::new("invalid_asset_id", "Invalid media asset ID"))?;
    let transcript_uuid = Uuid::parse_str(&transcript_id)
        .map_err(|_| SubtitleCommandError::new("invalid_transcript_id", "Invalid transcript ID"))?;
    let transcripts = list_transcripts(
        app.clone(), project_uuid.to_string(), asset_uuid.to_string(),
    ).map_err(|error| SubtitleCommandError::new("transcript_unavailable", format!("{error:?}")))?;
    let record = transcripts.into_iter()
        .find(|record| record.id == transcript_uuid.to_string())
        .ok_or_else(|| SubtitleCommandError::new("transcript_not_found", "Transcript does not belong to this project/asset"))?;
    let text = render_subtitles(&record.transcript, format)
        .map_err(|error| SubtitleCommandError::new("subtitle_validation_failed", error.to_string()))?;

    let root = app.path().app_data_dir()
        .map_err(|error| SubtitleCommandError::new("app_data_unavailable", error.to_string()))?
        .join("projects").join(project_uuid.to_string()).join("subtitles");
    fs::create_dir_all(&root)
        .map_err(|error| SubtitleCommandError::new("subtitle_io_error", error.to_string()))?;
    let filename = format!(
        "creator-subtitles-{}-{}.{}",
        transcript_uuid, Uuid::new_v4(), format.extension()
    );
    let target = root.join(filename);
    save_subtitles(&target, &text)?;
    Ok(SubtitleExportResult {
        transcript_id: transcript_uuid.to_string(),
        format,
        output_path: target.to_string_lossy().into_owned(),
        bytes_written: text.len() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_unique_file_and_does_not_modify_existing() {
        let root = std::env::temp_dir().join(format!("creator-subtitle-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let file = root.join("example.srt");
        save_subtitles(&file, "1\n00:00:00,000 --> 00:00:01,000\nHola\n\n").unwrap();
        let original = fs::read_to_string(&file).unwrap();
        // A second attempt must not silently overwrite an existing subtitle.
        // The product generates unique filenames for each export.
        let alternate = root.join("another.vtt");
        save_subtitles(&alternate, "WEBVTT\n\n").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), original);
        assert_eq!(fs::read_to_string(&alternate).unwrap(), "WEBVTT\n\n");
        fs::remove_dir_all(root).unwrap();
    }
}
