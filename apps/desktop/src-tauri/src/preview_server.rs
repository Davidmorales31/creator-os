use std::{fs, path::PathBuf};

use axum::{
    body::Body,
    extract::{Path as AxumPath, Query, State as AxumState},
    http::{header, HeaderValue, Request, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use creator_os_media_core::{MediaAsset, MediaCatalog, MediaKind};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tower::ServiceExt;
use tower_http::services::ServeFile;
use uuid::Uuid;

const PROJECTS_DIR: &str = "projects";
const MEDIA_DIR: &str = "media";
const MEDIA_INDEX_FILE: &str = "index.json";

#[derive(Clone)]
pub struct PreviewServerState {
    projects_root: PathBuf,
    port: u16,
    token: String,
}

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

#[derive(Debug, Deserialize)]
struct PreviewQuery {
    token: String,
}

pub fn start_preview_server(app: &AppHandle) -> Result<PreviewServerState, PreviewCommandError> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| PreviewCommandError::new("app_data_unavailable", error.to_string()))?;
    let listener = std::net::TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| PreviewCommandError::new("preview_bind_failed", error.to_string()))?;
    listener
        .set_nonblocking(true)
        .map_err(|error| PreviewCommandError::new("preview_bind_failed", error.to_string()))?;
    let port = listener
        .local_addr()
        .map_err(|error| PreviewCommandError::new("preview_bind_failed", error.to_string()))?
        .port();
    let state = PreviewServerState {
        projects_root: app_data.join(PROJECTS_DIR),
        port,
        token: Uuid::new_v4().simple().to_string(),
    };
    let router = Router::new()
        .route("/media/{project_id}/{asset_id}", get(serve_media))
        .with_state(state.clone());
    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("Creator OS preview listener failed: {error}");
                return;
            }
        };
        if let Err(error) = axum::serve(listener, router).await {
            eprintln!("Creator OS preview server stopped: {error}");
        }
    });
    Ok(state)
}

#[tauri::command]
pub fn get_media_preview_url(
    state: State<'_, PreviewServerState>,
    project_id: String,
    asset_id: String,
) -> Result<String, PreviewCommandError> {
    let project_id = validated_uuid(
        &project_id,
        "invalid_project_id",
        "Project id is not a valid UUID",
    )?;
    let asset_id = validated_uuid(
        &asset_id,
        "invalid_asset_id",
        "Asset id is not a valid UUID",
    )?;
    let asset = load_asset(&state.projects_root, &project_id, &asset_id)?;
    if asset.kind != MediaKind::Video {
        return Err(PreviewCommandError::new(
            "preview_unsupported",
            "Video Preview currently supports video assets only",
        ));
    }
    let source = PathBuf::from(&asset.source_path);
    if !source.is_file() {
        return Err(PreviewCommandError::new(
            "media_offline",
            format!("Source media is unavailable: {}", source.display()),
        ));
    }
    Ok(build_preview_url(
        state.port,
        &state.token,
        &project_id,
        &asset_id,
    ))
}

async fn serve_media(
    AxumState(state): AxumState<PreviewServerState>,
    AxumPath((project_id, asset_id)): AxumPath<(String, String)>,
    Query(query): Query<PreviewQuery>,
    request: Request<Body>,
) -> Response {
    if query.token != state.token {
        return StatusCode::FORBIDDEN.into_response();
    }
    let project_id = match validated_uuid(&project_id, "invalid_project_id", "Invalid project id") {
        Ok(value) => value,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };
    let asset_id = match validated_uuid(&asset_id, "invalid_asset_id", "Invalid asset id") {
        Ok(value) => value,
        Err(_) => return StatusCode::BAD_REQUEST.into_response(),
    };
    let asset = match load_asset(&state.projects_root, &project_id, &asset_id) {
        Ok(asset) if asset.kind == MediaKind::Video => asset,
        Ok(_) => return StatusCode::UNSUPPORTED_MEDIA_TYPE.into_response(),
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };
    let source = PathBuf::from(asset.source_path);
    if !source.is_file() {
        return StatusCode::NOT_FOUND.into_response();
    }
    let response = match ServeFile::new(source).oneshot(request).await {
        Ok(response) => response,
        Err(error) => match error {},
    };
    let mut response = response.map(Body::new);
    response
        .headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    response
}

fn load_asset(
    projects_root: &std::path::Path,
    project_id: &str,
    asset_id: &str,
) -> Result<MediaAsset, PreviewCommandError> {
    let catalog_path = projects_root
        .join(project_id)
        .join(MEDIA_DIR)
        .join(MEDIA_INDEX_FILE);
    if !catalog_path.is_file() {
        return Err(PreviewCommandError::new(
            "media_catalog_not_found",
            "The project does not have a media catalog yet",
        ));
    }
    let raw = fs::read_to_string(&catalog_path).map_err(|error| {
        PreviewCommandError::new(
            "media_catalog_read_failed",
            format!("{}: {error}", catalog_path.display()),
        )
    })?;
    let catalog: MediaCatalog = serde_json::from_str(&raw)
        .map_err(|error| PreviewCommandError::new("invalid_media_catalog", error.to_string()))?;
    catalog
        .assets
        .into_iter()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| PreviewCommandError::new("asset_not_found", "Media asset was not found"))
}

fn validated_uuid(
    value: &str,
    code: &'static str,
    message: &'static str,
) -> Result<String, PreviewCommandError> {
    Uuid::parse_str(value)
        .map(|id| id.to_string())
        .map_err(|_| PreviewCommandError::new(code, message))
}

fn build_preview_url(port: u16, token: &str, project_id: &str, asset_id: &str) -> String {
    format!("http://127.0.0.1:{port}/media/{project_id}/{asset_id}?token={token}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preview_url_is_loopback_and_uses_opaque_ids() {
        let project_id = "550e8400-e29b-41d4-a716-446655440000";
        let asset_id = "550e8400-e29b-41d4-a716-446655440001";
        let url = build_preview_url(43123, "session-token", project_id, asset_id);
        assert_eq!(url, "http://127.0.0.1:43123/media/550e8400-e29b-41d4-a716-446655440000/550e8400-e29b-41d4-a716-446655440001?token=session-token");
        assert!(!url.contains("C:\\"));
        assert!(!url.contains("/Users/"));
    }

    #[test]
    fn invalid_ids_are_rejected_before_path_construction() {
        let error = validated_uuid("../../etc/passwd", "invalid_asset_id", "bad")
            .expect_err("path-like ids must fail");
        assert_eq!(error.code, "invalid_asset_id");
    }
}
