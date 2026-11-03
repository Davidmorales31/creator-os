use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Read},
    path::PathBuf,
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use creator_os_render_core::{RenderError, RenderPlan, RenderSettings};
use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::{
    export_adapter::build_ffmpeg_args,
    media_repository::FsMediaRepository,
    project_repository::FsProjectRepository,
    timeline_commands::TimelineWriteGuard,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ExportStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportJob {
    pub id: String,
    pub status: ExportStatus,
    pub progress: f64,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

struct ExportEntry {
    info: ExportJob,
    cancel_requested: bool,
}
#[derive(Default)]
struct Shared {
    jobs: HashMap<String, ExportEntry>,
    active: Option<String>,
}
#[derive(Default, Clone)]
pub struct ExportManager {
    inner: Arc<Mutex<Shared>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCommandError {
    pub code: &'static str,
    pub message: String,
}
impl ExportCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}
impl From<RenderError> for ExportCommandError {
    fn from(value: RenderError) -> Self {
        let code = match value {
            RenderError::InvalidTimeline(_) => "invalid_timeline",
            RenderError::InvalidSettings => "invalid_export_settings",
            RenderError::EmptyTimeline => "empty_timeline",
            RenderError::UnsupportedTracks => "unsupported_export_tracks",
            RenderError::UnsupportedMedia => "unsupported_export_media",
            RenderError::GappedTimeline => "gapped_export_timeline",
            RenderError::MissingAsset => "missing_export_asset",
            RenderError::InvalidSourceDuration => "invalid_export_duration",
            RenderError::InvalidSourceBounds => "invalid_export_bounds",
            RenderError::InvalidLength => "invalid_export_length",
        };
        Self::new(code, value.to_string())
    }
}
fn map_project<E: std::fmt::Debug>(error: E) -> ExportCommandError {
    ExportCommandError::new("project_unavailable", format!("{error:?}"))
}
fn map_media<E: std::fmt::Debug>(error: E) -> ExportCommandError {
    ExportCommandError::new("media_catalog_unavailable", format!("{error:?}"))
}
fn map_io(error: std::io::Error) -> ExportCommandError {
    ExportCommandError::new("export_io_error", error.to_string())
}

impl ExportManager {
    fn update(&self, id: &str, modify: impl FnOnce(&mut ExportJob)) {
        if let Ok(mut shared) = self.inner.lock() {
            if let Some(entry) = shared.jobs.get_mut(id) { modify(&mut entry.info); }
        }
    }

    fn finish(&self, id: &str, result: Result<PathBuf, String>, was_cancelled: bool) {
        if let Ok(mut shared) = self.inner.lock() {
            if let Some(entry) = shared.jobs.get_mut(id) {
                if was_cancelled {
                    entry.info.status = ExportStatus::Cancelled;
                    entry.info.error = None;
                } else {
                    match result {
                        Ok(path) => {
                            entry.info.status = ExportStatus::Completed;
                            entry.info.progress = 1.0;
                            entry.info.output_path = Some(path.to_string_lossy().into_owned());
                        }
                        Err(message) => {
                            entry.info.status = ExportStatus::Failed;
                            entry.info.error = Some(message);
                        }
                    }
                }
            }
            if shared.active.as_deref() == Some(id) { shared.active = None; }
        }
    }

    fn cancellation_requested(&self, id: &str) -> bool {
        self.inner.lock().ok()
            .and_then(|state| state.jobs.get(id).map(|entry| entry.cancel_requested))
            .unwrap_or(true)
    }
}

fn parse_progress_line(line: &str) -> Option<f64> {
    let value = line.trim().strip_prefix("out_time_us=")?;
    let microseconds = value.parse::<i64>().ok()?;
    (microseconds >= 0).then_some(microseconds as f64 / 1_000_000.0)
}

fn render_in_worker(
    manager: &ExportManager, id: &str, plan: &RenderPlan, temporary: &PathBuf, final_path: &PathBuf,
) -> Result<PathBuf, String> {
    if manager.cancellation_requested(id) { return Err("Export cancelled".into()); }
    manager.update(id, |job| job.status = ExportStatus::Running);
    let ffmpeg = std::env::var_os("CREATOR_OS_FFMPEG_PATH")
        .unwrap_or_else(|| "ffmpeg".into());
    let mut child = Command::new(&ffmpeg)
        .args(build_ffmpeg_args(plan, temporary))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("FFmpeg unavailable or failed to start: {error}"))?;

    let stdout = child.stdout.take().ok_or("FFmpeg progress channel missing")?;
    let stderr = child.stderr.take().ok_or("FFmpeg error channel missing")?;
    let progress_owner = manager.clone();
    let progress_id = id.to_owned();
    let duration = plan.duration_seconds();
    let progress_thread = thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            if let Some(seconds) = parse_progress_line(&line) {
                progress_owner.update(&progress_id, |job| {
                    job.progress = (seconds / duration).clamp(0.0, 0.99);
                });
            }
        }
    });
    let errors_thread = thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buffer = String::new();
        // Keep the latest 4KB of FFmpeg diagnostic output without unbounded memory use.
        let mut chunk = [0_u8; 1024];
        while let Ok(count) = reader.read(&mut chunk) {
            if count == 0 { break; }
            buffer.push_str(&String::from_utf8_lossy(&chunk[..count]));
            if buffer.len() > 4096 {
                buffer = buffer.chars().rev().take(3000).collect::<String>().chars().rev().collect();
            }
        }
        buffer
    });

    let outcome = loop {
        if manager.cancellation_requested(id) {
            let _ = child.kill();
            break child.wait().map_err(|error| error.to_string());
        }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) => thread::sleep(Duration::from_millis(120)),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(error.to_string());
            }
        }
    };
    let _ = progress_thread.join();
    let diagnostics = errors_thread.join().unwrap_or_default();
    if manager.cancellation_requested(id) { return Err("Export cancelled".into()); }
    match outcome {
        Ok(status) if status.success() => {}
        Ok(status) => return Err(format!("FFmpeg exited with {status}: {}", diagnostics.trim())),
        Err(error) => return Err(format!("FFmpeg failed: {error}")),
    }
    let file = fs::metadata(temporary).map_err(|error| format!("Export output missing: {error}"))?;
    if file.len() == 0 { return Err("FFmpeg generated an empty export".into()); }
    if manager.cancellation_requested(id) { return Err("Export cancelled".into()); }
    fs::rename(temporary, final_path)
        .map_err(|error| format!("Could not finalize export: {error}"))?;
    Ok(final_path.clone())
}

#[tauri::command]
pub fn start_export(
    app: AppHandle,
    manager: State<'_, ExportManager>,
    write_guard: State<'_, TimelineWriteGuard>,
    project_id: String,
) -> Result<ExportJob, ExportCommandError> {
    // Snapshot project and catalog while editor writes are serialized.
    let (project, assets) = {
        let _guard = write_guard.0.lock().map_err(|_| ExportCommandError::new("timeline_busy", "Editor is busy"))?;
        let project = FsProjectRepository::from_app(&app).map_err(map_project)?.open(&project_id).map_err(map_project)?;
        let assets = FsMediaRepository::from_app(&app).map_err(map_media)?.list(&project_id).map_err(map_media)?;
        (project, assets)
    };
    let plan = RenderPlan::build(
        &project.timeline, &assets,
        RenderSettings { width: project.settings.width, height: project.settings.height, fps: project.settings.fps },
    )?;
    for segment in &plan.segments {
        if !std::path::Path::new(&segment.source_path).is_file() {
            return Err(ExportCommandError::new("media_source_missing", "A referenced source file is missing"));
        }
    }
    let exports = app.path().app_data_dir().map_err(|error| ExportCommandError::new("app_data_unavailable", error.to_string()))?
        .join("projects").join(&project.id).join("exports");
    fs::create_dir_all(&exports).map_err(map_io)?;
    let id = Uuid::new_v4().to_string();
    let final_path = exports.join(format!("creator-export-{id}.mp4"));
    let temporary = exports.join(format!(".creator-export-{id}.partial.mp4"));
    let entry = ExportJob { id: id.clone(), status: ExportStatus::Queued, progress: 0.0, output_path: None, error: None };

    {
        let mut shared = manager.inner.lock().map_err(|_| ExportCommandError::new("export_lock_failed", "Export state unavailable"))?;
        if shared.active.is_some() { return Err(ExportCommandError::new("export_busy", "Only one render can run at a time")); }
        // Keep only the most recent 20 completed jobs; never remove the active one.
        if shared.jobs.len() >= 20 {
            shared.jobs.retain(|_, record| matches!(record.info.status, ExportStatus::Queued | ExportStatus::Running));
        }
        shared.active = Some(id.clone());
        shared.jobs.insert(id.clone(), ExportEntry { info: entry.clone(), cancel_requested: false });
    }

    let worker_manager = manager.inner().clone();
    thread::spawn(move || {
        let result = render_in_worker(&worker_manager, &id, &plan, &temporary, &final_path);
        let cancelled = result.is_err() && worker_manager.cancellation_requested(&id);
        if result.is_err() { let _ = fs::remove_file(&temporary); }
        worker_manager.finish(&id, result, cancelled);
    });
    Ok(entry)
}

#[tauri::command]
pub fn get_export_status(manager: State<'_, ExportManager>, job_id: String) -> Result<ExportJob, ExportCommandError> {
    let shared = manager.inner.lock().map_err(|_| ExportCommandError::new("export_lock_failed", "Export state unavailable"))?;
    shared.jobs.get(&job_id).map(|entry| entry.info.clone())
        .ok_or_else(|| ExportCommandError::new("export_not_found", "Export job does not exist"))
}

#[tauri::command]
pub fn cancel_export(manager: State<'_, ExportManager>, job_id: String) -> Result<ExportJob, ExportCommandError> {
    let mut shared = manager.inner.lock().map_err(|_| ExportCommandError::new("export_lock_failed", "Export state unavailable"))?;
    let entry = shared.jobs.get_mut(&job_id)
        .ok_or_else(|| ExportCommandError::new("export_not_found", "Export job does not exist"))?;
    if matches!(entry.info.status, ExportStatus::Queued | ExportStatus::Running) {
        entry.cancel_requested = true;
    }
    Ok(entry.info.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn progress_parser_is_bounded_and_uses_microseconds() {
        assert_eq!(parse_progress_line("out_time_us=1500000"), Some(1.5));
        assert_eq!(parse_progress_line("out_time_us=-1"), None);
        assert_eq!(parse_progress_line("progress=continue"), None);
    }
    #[test]
    fn cancellations_do_not_claim_completed() {
        let manager = ExportManager::default();
        let id = "job".to_owned();
        manager.inner.lock().unwrap().jobs.insert(id.clone(), ExportEntry {
            info: ExportJob { id: id.clone(), status: ExportStatus::Running, progress: 0.5, output_path: None, error: None },
            cancel_requested: true,
        });
        manager.finish(&id, Err("cancelled".into()), true);
        assert_eq!(manager.inner.lock().unwrap().jobs[&id].info.status, ExportStatus::Cancelled);
    }
}
