use std::sync::Mutex;

use creator_os_media_core::MediaKind;
use creator_os_timeline_core::{Clip, Timeline, TimelineError, TimelineOperation, TrackKind};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::{media_repository::FsMediaRepository, project_repository::FsProjectRepository};

#[derive(Default)]
pub struct TimelineWriteGuard(pub Mutex<()>);

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineCommandError {
    code: &'static str,
    message: String,
}

impl TimelineCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<TimelineError> for TimelineCommandError {
    fn from(error: TimelineError) -> Self {
        let code = match error {
            TimelineError::UnsupportedVersion => "unsupported_timeline_version",
            TimelineError::DuplicateId => "duplicate_timeline_id",
            TimelineError::NotFound => "timeline_item_not_found",
            TimelineError::IncompatibleTrack => "incompatible_track",
            TimelineError::InvalidRange => "invalid_clip_range",
            TimelineError::Overlap => "clip_overlap",
            TimelineError::StaleRevision => "stale_timeline_revision",
            TimelineError::EmptyHistory => "empty_timeline_history",
        };
        Self::new(code, error.to_string())
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum TimelineEdit {
    Apply { operation: TimelineOperation },
    Undo,
    Redo,
}

fn validate_asset_for_add(
    app: &AppHandle,
    project_id: &str,
    fps: u32,
    clip: &Clip,
) -> Result<(), TimelineCommandError> {
    let assets = FsMediaRepository::from_app(app)
        .map_err(|error| TimelineCommandError::new(error.code, error.message))?
        .list(project_id)
        .map_err(|error| TimelineCommandError::new(error.code, error.message))?;
    let asset = assets
        .iter()
        .find(|asset| asset.id == clip.asset_id)
        .ok_or_else(|| {
            TimelineCommandError::new(
                "media_asset_not_found",
                "Import the media asset before adding it to the timeline",
            )
        })?;
    let kind = match asset.kind {
        MediaKind::Video | MediaKind::Image => TrackKind::Video,
        MediaKind::Audio => TrackKind::Audio,
    };
    if kind != clip.kind {
        return Err(TimelineCommandError::new(
            "incompatible_media_kind",
            "Clip kind must match the registered media asset",
        ));
    }
    let source_length = match asset.kind {
        MediaKind::Image => None,
        _ => asset.duration_seconds.and_then(|seconds| {
            let frames = seconds * f64::from(fps);
            (frames.is_finite() && frames >= 1.0 && frames <= u64::MAX as f64)
                .then_some(frames.floor() as u64)
        }),
    };
    if let Some(max) = source_length {
        if clip
            .source_in_frame
            .checked_add(clip.duration_frames)
            .is_none_or(|end| end > max)
        {
            return Err(TimelineCommandError::new(
                "invalid_clip_range",
                "Clip extends beyond the source media",
            ));
        }
    } else if asset.kind != MediaKind::Image {
        return Err(TimelineCommandError::new(
            "invalid_media_duration",
            "Source media needs a valid duration",
        ));
    }
    if clip.source_length_frames != source_length {
        return Err(TimelineCommandError::new(
            "invalid_source_length",
            "Clip source duration does not match catalog metadata",
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn get_timeline(app: AppHandle, project_id: String) -> Result<Timeline, TimelineCommandError> {
    let repo = FsProjectRepository::from_app(&app)
        .map_err(|error| TimelineCommandError::new(error.code, error.message))?;
    let project = repo
        .open(&project_id)
        .map_err(|error| TimelineCommandError::new(error.code, error.message))?;
    Ok(project.timeline)
}

#[tauri::command]
pub fn edit_timeline(
    app: AppHandle,
    state: State<'_, TimelineWriteGuard>,
    project_id: String,
    expected_revision: u64,
    command: TimelineEdit,
) -> Result<Timeline, TimelineCommandError> {
    // Serializes the read/validate/write transaction across all Tauri invocations.
    let _guard = state.0.lock().map_err(|_| {
        TimelineCommandError::new(
            "timeline_lock_failed",
            "Could not lock timeline for editing",
        )
    })?;
    let repo = FsProjectRepository::from_app(&app)
        .map_err(|error| TimelineCommandError::new(error.code, error.message))?;
    let mut project = repo
        .open(&project_id)
        .map_err(|error| TimelineCommandError::new(error.code, error.message))?;
    match command {
        TimelineEdit::Apply { operation } => {
            if let TimelineOperation::AddClip { ref clip } = operation {
                validate_asset_for_add(&app, &project_id, project.settings.fps, clip)?;
            }
            project.timeline.apply(expected_revision, operation)?;
        }
        TimelineEdit::Undo => project.timeline.undo(expected_revision)?,
        TimelineEdit::Redo => project.timeline.redo(expected_revision)?,
    }
    project.updated_at = chrono::Utc::now().to_rfc3339();
    repo.save(&project)
        .map_err(|error| TimelineCommandError::new(error.code, error.message))?;
    Ok(project.timeline)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_edit_command_decodes_browser_camel_case_payload() {
        let payload = serde_json::json!({
            "action": "apply",
            "operation": {
                "type": "trimClip",
                "clipId": "clip-1",
                "startFrame": 120,
                "sourceInFrame": 24,
                "durationFrames": 96
            }
        });
        let command: TimelineEdit = serde_json::from_value(payload)
            .expect("UI native timeline command must decode without snake_case fields");
        match command {
            TimelineEdit::Apply {
                operation:
                    TimelineOperation::TrimClip {
                        clip_id,
                        start_frame,
                        source_in_frame,
                        duration_frames,
                    },
            } => {
                assert_eq!(clip_id, "clip-1");
                assert_eq!(
                    (start_frame, source_in_frame, duration_frames),
                    (120, 24, 96)
                );
            }
            _ => panic!("expected a trim edit"),
        }
    }

    #[test]
    fn errors_have_stable_codes() {
        let error = TimelineCommandError::from(TimelineError::Overlap);
        assert_eq!(error.code, "clip_overlap");
        let error = TimelineCommandError::from(TimelineError::StaleRevision);
        assert_eq!(error.code, "stale_timeline_revision");
    }
}
