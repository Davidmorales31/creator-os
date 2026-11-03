use std::{
    collections::HashMap,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use chrono::Utc;
use creator_os_media_core::MediaKind;
use creator_os_transcript_core::{Transcript, TranscriptRecord};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

use crate::{media_repository::FsMediaRepository, project_repository::FsProjectRepository};

const MAX_TRANSCRIPT_BYTES: u64 = 12 * 1024 * 1024;
const MAX_VISIBLE_JOBS: usize = 20;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TranscriptionStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionJob {
    pub id: String,
    pub asset_id: String,
    pub status: TranscriptionStatus,
    pub result_id: Option<String>,
    pub error: Option<String>,
    pub error_code: Option<String>,
}

struct JobEntry {
    job: TranscriptionJob,
    cancellation_requested: bool,
}
#[derive(Default)]
struct Shared {
    jobs: HashMap<String, JobEntry>,
    active: Option<String>,
}
#[derive(Clone, Default)]
pub struct TranscriptionManager {
    inner: Arc<Mutex<Shared>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionCommandError {
    code: &'static str,
    message: String,
}
impl TranscriptionCommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum ModelChoice {
    Tiny,
    Base,
    Small,
}
impl ModelChoice {
    fn as_str(self) -> &'static str {
        match self {
            Self::Tiny => "tiny",
            Self::Base => "base",
            Self::Small => "small",
        }
    }
}
#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum LanguageChoice {
    Auto,
    Es,
    En,
}
impl LanguageChoice {
    fn as_str(self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::Es => "es",
            Self::En => "en",
        }
    }
}

#[derive(Debug, Deserialize)]
struct WorkerResult {
    result: Option<Transcript>,
    error: Option<WorkerError>,
}
#[derive(Debug, Deserialize)]
struct WorkerError {
    code: String,
    message: String,
}
fn paths(app: &AppHandle, project_id: &str) -> Result<PathBuf, TranscriptionCommandError> {
    // Every file path comes from app storage plus validated UUID; no UI-provided paths.
    let id = Uuid::parse_str(project_id)
        .map_err(|_| TranscriptionCommandError::new("invalid_project_id", "Invalid project ID"))?;
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| TranscriptionCommandError::new("app_data_unavailable", e.to_string()))?;
    Ok(base
        .join("projects")
        .join(id.to_string())
        .join("audio")
        .join("transcripts"))
}

#[derive(Clone, Copy)]
struct TranscriptionOptions {
    model: ModelChoice,
    language: LanguageChoice,
    allow_download: bool,
}

fn run_python(
    manager: &TranscriptionManager,
    job_id: &str,
    asset_id: &str,
    source: &Path,
    target: &Path,
    options: TranscriptionOptions,
) -> Result<TranscriptRecord, (String, String)> {
    let output = target.with_extension("json.tmp");
    let python: OsString =
        std::env::var_os("CREATOR_OS_PYTHON_PATH").unwrap_or_else(|| OsString::from("python"));
    let mut command = Command::new(python);
    command
        .args(["-m", "creator_os_ai_worker.transcribe_cli", "--media"])
        .arg(source)
        .args(["--asset-id", asset_id, "--output"])
        .arg(&output)
        .args(["--model", options.model.as_str(), "--language", options.language.as_str()])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if options.allow_download {
        command.arg("--allow-download");
    }

    let mut child = command.spawn().map_err(|error| {
        (
            "python_unavailable".into(),
            format!("Python worker unavailable: {error}"),
        )
    })?;
    let status = loop {
        if manager.cancel_requested(job_id) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(("cancelled".into(), "Transcription cancelled".into()));
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => thread::sleep(Duration::from_millis(150)),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(("worker_failed".into(), error.to_string()));
            }
        }
    };

    if manager.cancel_requested(job_id) {
        return Err(("cancelled".into(), "Transcription cancelled".into()));
    }
    let size = fs::metadata(&output).map_err(|_| {
        ("worker_failed".into(), format!(
            "The Python worker produced no result (exit {status}). Install ai/worker[transcription]."
        ))
    })?.len();
    if size == 0 || size > MAX_TRANSCRIPT_BYTES {
        return Err((
            "invalid_transcript".into(),
            "Transcript output is empty or too large".into(),
        ));
    }
    let raw = fs::read(&output).map_err(|error| ("worker_failed".into(), error.to_string()))?;
    let payload: WorkerResult = serde_json::from_slice(&raw)
        .map_err(|error| ("invalid_transcript".into(), error.to_string()))?;
    if let Some(error) = payload.error {
        return Err((error.code, error.message));
    }
    if !status.success() {
        return Err((
            "worker_failed".into(),
            format!("Worker exited with {status}"),
        ));
    }
    let transcript = payload.result.ok_or_else(|| {
        (
            "invalid_transcript".into(),
            "Missing transcription result".into(),
        )
    })?;
    transcript
        .validate()
        .map_err(|error| ("invalid_transcript".into(), error.to_string()))?;
    if transcript.asset_id != asset_id {
        return Err((
            "asset_mismatch".into(),
            "Worker returned a different asset ID".into(),
        ));
    }
    let record = TranscriptRecord {
        id: job_id.to_owned(),
        created_at: Utc::now().to_rfc3339(),
        transcript,
    };
    // Generate a completed-file payload separately: the worker cannot author arbitrary metadata.
    let staging = target.with_extension("record.tmp");
    fs::write(
        &staging,
        serde_json::to_vec_pretty(&record)
            .map_err(|error| ("serialization_failed".into(), error.to_string()))?,
    )
    .map_err(|error| ("transcript_io_error".into(), error.to_string()))?;
    if manager.cancel_requested(job_id) {
        let _ = fs::remove_file(staging);
        return Err(("cancelled".into(), "Transcription cancelled".into()));
    }
    fs::rename(&staging, target)
        .map_err(|error| ("transcript_io_error".into(), error.to_string()))?;
    Ok(record)
}
impl TranscriptionManager {
    fn cancel_requested(&self, id: &str) -> bool {
        self.inner
            .lock()
            .ok()
            .and_then(|s| s.jobs.get(id).map(|j| j.cancellation_requested))
            .unwrap_or(true)
    }
    fn finish(&self, id: &str, result: Result<TranscriptRecord, (String, String)>) {
        if let Ok(mut shared) = self.inner.lock() {
            if let Some(entry) = shared.jobs.get_mut(id) {
                match result {
                    Ok(record) => {
                        entry.job.status = TranscriptionStatus::Completed;
                        entry.job.result_id = Some(record.id);
                    }
                    Err((code, _message)) if code == "cancelled" => {
                        entry.job.status = TranscriptionStatus::Cancelled;
                        entry.job.error = None;
                    }
                    Err((code, message)) => {
                        entry.job.status = TranscriptionStatus::Failed;
                        entry.job.error_code = Some(code);
                        entry.job.error = Some(message);
                    }
                }
            }
            if shared.active.as_deref() == Some(id) {
                shared.active = None;
            }
        }
    }
}

#[tauri::command]
pub fn start_transcription(
    app: AppHandle,
    manager: State<'_, TranscriptionManager>,
    project_id: String,
    asset_id: String,
    model: ModelChoice,
    language: LanguageChoice,
    allow_download: bool,
) -> Result<TranscriptionJob, TranscriptionCommandError> {
    let id = Uuid::parse_str(&asset_id).map_err(|_| {
        TranscriptionCommandError::new("invalid_asset_id", "Invalid media asset ID")
    })?;
    let project = FsProjectRepository::from_app(&app)
        .map_err(|e| TranscriptionCommandError::new("project_unavailable", format!("{e:?}")))?
        .open(&project_id)
        .map_err(|e| TranscriptionCommandError::new("project_unavailable", format!("{e:?}")))?;
    let assets = FsMediaRepository::from_app(&app)
        .map_err(|e| TranscriptionCommandError::new("media_unavailable", format!("{e:?}")))?
        .list(&project_id)
        .map_err(|e| TranscriptionCommandError::new("media_unavailable", format!("{e:?}")))?;
    let asset = assets
        .iter()
        .find(|candidate| candidate.id == id.to_string())
        .ok_or_else(|| {
            TranscriptionCommandError::new(
                "asset_not_found",
                "Media not registered in this project",
            )
        })?;
    if asset.kind == MediaKind::Image || asset.audio_codec.is_none() {
        return Err(TranscriptionCommandError::new(
            "no_audio_stream",
            "Choose imported video/audio containing an audio stream",
        ));
    }
    let source = PathBuf::from(&asset.source_path);
    if !source.is_file() {
        return Err(TranscriptionCommandError::new(
            "media_missing",
            "Media source is missing",
        ));
    }
    let transcripts = paths(&app, &project.id)?;
    fs::create_dir_all(&transcripts)
        .map_err(|e| TranscriptionCommandError::new("transcript_io_error", e.to_string()))?;

    let job_id = Uuid::new_v4().to_string();
    let job = TranscriptionJob {
        id: job_id.clone(),
        asset_id: asset_id.clone(),
        status: TranscriptionStatus::Queued,
        result_id: None,
        error: None,
        error_code: None,
    };
    {
        let mut shared = manager.inner.lock().map_err(|_| {
            TranscriptionCommandError::new("transcription_busy", "Transcription state unavailable")
        })?;
        if shared.active.is_some() {
            return Err(TranscriptionCommandError::new(
                "transcription_busy",
                "Only one local transcription can run at a time",
            ));
        }
        if shared.jobs.len() >= MAX_VISIBLE_JOBS {
            shared.jobs.retain(|_, entry| {
                matches!(
                    entry.job.status,
                    TranscriptionStatus::Running | TranscriptionStatus::Queued
                )
            });
        }
        shared.active = Some(job_id.clone());
        shared.jobs.insert(
            job_id.clone(),
            JobEntry {
                job: job.clone(),
                cancellation_requested: false,
            },
        );
    }

    let target = transcripts.join(format!("{job_id}.json"));
    let worker = manager.inner().clone();
    thread::spawn(move || {
        if let Ok(mut state) = worker.inner.lock() {
            if let Some(entry) = state.jobs.get_mut(&job_id) {
                entry.job.status = TranscriptionStatus::Running;
            }
        }
        let result = run_python(
            &worker,
            &job_id,
            &asset_id,
            &source,
            &target,
            TranscriptionOptions {
                model,
                language,
                allow_download,
            },
        );
        let _ = fs::remove_file(target.with_extension("json.tmp"));
        let _ = fs::remove_file(target.with_extension("record.tmp"));
        worker.finish(&job_id, result);
    });
    Ok(job)
}

#[tauri::command]
pub fn get_transcription_status(
    manager: State<'_, TranscriptionManager>,
    job_id: String,
) -> Result<TranscriptionJob, TranscriptionCommandError> {
    let shared = manager.inner.lock().map_err(|_| {
        TranscriptionCommandError::new(
            "transcription_unavailable",
            "Transcription manager unavailable",
        )
    })?;
    shared
        .jobs
        .get(&job_id)
        .map(|job| job.job.clone())
        .ok_or_else(|| {
            TranscriptionCommandError::new("transcription_not_found", "Transcription job not found")
        })
}

#[tauri::command]
pub fn cancel_transcription(
    manager: State<'_, TranscriptionManager>,
    job_id: String,
) -> Result<TranscriptionJob, TranscriptionCommandError> {
    let mut shared = manager.inner.lock().map_err(|_| {
        TranscriptionCommandError::new(
            "transcription_unavailable",
            "Transcription manager unavailable",
        )
    })?;
    let entry = shared.jobs.get_mut(&job_id).ok_or_else(|| {
        TranscriptionCommandError::new("transcription_not_found", "Transcription job not found")
    })?;
    if matches!(
        entry.job.status,
        TranscriptionStatus::Queued | TranscriptionStatus::Running
    ) {
        entry.cancellation_requested = true;
    }
    Ok(entry.job.clone())
}

#[tauri::command]
pub fn list_transcripts(
    app: AppHandle,
    project_id: String,
    asset_id: String,
) -> Result<Vec<TranscriptRecord>, TranscriptionCommandError> {
    let asset_id = Uuid::parse_str(&asset_id)
        .map_err(|_| TranscriptionCommandError::new("invalid_asset_id", "Invalid asset ID"))?
        .to_string();
    // Validate project and asset ownership before looking up transcript data.
    let _project = FsProjectRepository::from_app(&app)
        .map_err(|e| TranscriptionCommandError::new("project_unavailable", format!("{e:?}")))?
        .open(&project_id)
        .map_err(|e| TranscriptionCommandError::new("project_unavailable", format!("{e:?}")))?;
    let assets = FsMediaRepository::from_app(&app)
        .map_err(|e| TranscriptionCommandError::new("media_unavailable", format!("{e:?}")))?
        .list(&project_id)
        .map_err(|e| TranscriptionCommandError::new("media_unavailable", format!("{e:?}")))?;
    if !assets.iter().any(|asset| asset.id == asset_id) {
        return Err(TranscriptionCommandError::new(
            "asset_not_found",
            "Asset does not belong to project",
        ));
    }
    let root = paths(&app, &project_id)?;
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    for file in fs::read_dir(root)
        .map_err(|e| TranscriptionCommandError::new("transcript_io_error", e.to_string()))?
    {
        let file =
            file.map_err(|e| TranscriptionCommandError::new("transcript_io_error", e.to_string()))?;
        let path = file.path();
        if path.extension().is_none_or(|ext| ext != "json") || !path.is_file() {
            continue;
        }
        let metadata = fs::metadata(&path)
            .map_err(|e| TranscriptionCommandError::new("transcript_io_error", e.to_string()))?;
        if metadata.len() > MAX_TRANSCRIPT_BYTES {
            return Err(TranscriptionCommandError::new(
                "invalid_transcript",
                "Transcript file exceeds limit",
            ));
        }
        let raw = fs::read(&path)
            .map_err(|e| TranscriptionCommandError::new("transcript_io_error", e.to_string()))?;
        let record: TranscriptRecord = serde_json::from_slice(&raw)
            .map_err(|e| TranscriptionCommandError::new("invalid_transcript", e.to_string()))?;
        record
            .transcript
            .validate()
            .map_err(|e| TranscriptionCommandError::new("invalid_transcript", e.to_string()))?;
        if record.transcript.asset_id == asset_id {
            records.push(record);
        }
    }
    records.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn running_job_cannot_be_started_twice_and_cancellation_is_typed() {
        let manager = TranscriptionManager::default();
        let job_id = "job-1".to_owned();
        manager.inner.lock().unwrap().jobs.insert(
            job_id.clone(),
            JobEntry {
                job: TranscriptionJob {
                    id: job_id.clone(),
                    asset_id: "asset".into(),
                    status: TranscriptionStatus::Running,
                    result_id: None,
                    error: None,
                    error_code: None,
                },
                cancellation_requested: true,
            },
        );
        assert!(manager.cancel_requested(&job_id));
        manager.finish(&job_id, Err(("cancelled".into(), "cancelled".into())));
        assert_eq!(
            manager.inner.lock().unwrap().jobs[&job_id].job.status,
            TranscriptionStatus::Cancelled
        );
    }
}
