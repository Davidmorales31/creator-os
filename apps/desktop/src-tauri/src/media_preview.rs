use std::{fs, path::PathBuf};

use creator_os_media_core::{MediaAsset, MediaCatalog};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const PROJECTS_DIR: &str = "projects";
const MEDIA_INDEX: [&str; 2] = ["media", "index.json"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCommandError {
    pub code: &'static str,
    pub message: String,
}

impl PreviewCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<std::io::Error> for PreviewCommandError {
    fn from(error: std::io::Error) -> Self {
        Self::new("preview_io_error", error.to_string())
    }
}

impl From<serde_json::Error> for PreviewCommandError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("invalid_media_metadata", error.to_string())
    }
}

fn validated_project_id(project_id: &str) -> Result<String, PreviewCommandError> {
    Uuid::parse_str(project_id)
        .map(|id| id.to_string())
        .map_err(|_| PreviewCommandError::new("invalid_project_id", "Project id is not a valid UUID"))
}

fn load_asset(app: &AppHandle, project_id: &str, asset_id: &str) -> Result<MediaAsset, PreviewCommandError> {
    let project_id = validated_project_id(project_id)?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| PreviewCommandError::new("app_data_unavailable", error.to_string()))?;

    let index = app_data
        .join(PROJECTS_DIR)
        .join(project_id)
        .join(MEDIA_INDEX[0])
        .join(MEDIA_INDEX[1]);

    if !index.exists() {
        return Err(PreviewCommandError::new(
            "media_catalog_not_found",
            "This project does not have a media catalog yet",
        ));
    }

    let raw = fs::read_to_string(index)?;
    let catalog: MediaCatalog = serde_json::from_str(&raw)?;
    catalog
        .assets
        .into_iter()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| PreviewCommandError::new("media_asset_not_found", "Media asset was not found in this project"))
}

#[tauri::command]
pub fn prepare_media_preview(
    app: AppHandle,
    project_id: String,
    asset_id: String,
) -> Result<MediaAsset, PreviewCommandError> {
    let asset = load_asset(&app, &project_id, &asset_id)?;
    let source = PathBuf::from(&asset.source_path);

    if !source.exists() {
        return Err(PreviewCommandError::new(
            "media_source_missing",
            format!("The original media file no longer exists: {}", source.display()),
        ));
    }
    if !source.is_file() {
        return Err(PreviewCommandError::new(
            "media_source_invalid",
            "The media source is no longer a regular file",
        ));
    }

    let canonical = source.canonicalize()?;
    app.asset_protocol_scope()
        .allow_file(&canonical)
        .map_err(|error| PreviewCommandError::new("preview_scope_failed", error.to_string()))?;

    Ok(asset)
}
