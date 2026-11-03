use std::{fs, path::PathBuf};

use chrono::Utc;
use creator_os_project_core::{Project, ProjectSummary, ProjectValidationError};
use serde::Serialize;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const PROJECTS_DIR: &str = "projects";
const PROJECT_FILE: &str = "project.json";
const PROJECT_SUBDIRS: &[&str] = &["media", "proxies", "cache", "audio", "exports", "thumbnails"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
}

impl CommandError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

impl From<std::io::Error> for CommandError {
    fn from(error: std::io::Error) -> Self {
        Self::new("io_error", error.to_string())
    }
}

impl From<serde_json::Error> for CommandError {
    fn from(error: serde_json::Error) -> Self {
        Self::new("invalid_project_file", error.to_string())
    }
}

impl From<ProjectValidationError> for CommandError {
    fn from(error: ProjectValidationError) -> Self {
        Self::new("invalid_project", error.to_string())
    }
}

pub struct FsProjectRepository {
    projects_root: PathBuf,
}

impl FsProjectRepository {
    pub fn from_app(app: &AppHandle) -> Result<Self, CommandError> {
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|error| CommandError::new("app_data_unavailable", error.to_string()))?;

        Ok(Self {
            projects_root: app_data.join(PROJECTS_DIR),
        })
    }

    pub fn create(&self, name: String) -> Result<Project, CommandError> {
        let now = Utc::now().to_rfc3339();
        let project = Project::create(Uuid::new_v4().to_string(), name, now)?;
        self.save(&project)?;
        Ok(project)
    }

    pub fn open(&self, project_id: &str) -> Result<Project, CommandError> {
        let project_id = Self::validated_project_id(project_id)?;
        let path = self.project_dir(&project_id).join(PROJECT_FILE);

        if !path.exists() {
            return Err(CommandError::new(
                "project_not_found",
                format!("Project {project_id} was not found"),
            ));
        }

        let raw = fs::read_to_string(path)?;
        let project: Project = serde_json::from_str(&raw)?;
        Ok(project)
    }

    pub fn list_recent(&self) -> Result<Vec<ProjectSummary>, CommandError> {
        if !self.projects_root.exists() {
            return Ok(Vec::new());
        }

        let mut projects = Vec::new();
        for entry in fs::read_dir(&self.projects_root)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }

            let manifest = entry.path().join(PROJECT_FILE);
            if !manifest.exists() {
                continue;
            }

            let raw = fs::read_to_string(&manifest)?;
            let project: Project = serde_json::from_str(&raw).map_err(|error| {
                CommandError::new(
                    "invalid_project_file",
                    format!("{}: {error}", manifest.display()),
                )
            })?;
            projects.push(project.summary());
        }

        projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        Ok(projects)
    }

    fn save(&self, project: &Project) -> Result<(), CommandError> {
        let project_dir = self.project_dir(&project.id);
        fs::create_dir_all(&project_dir)?;
        for subdir in PROJECT_SUBDIRS {
            fs::create_dir_all(project_dir.join(subdir))?;
        }

        let serialized = serde_json::to_string_pretty(project)?;
        let target = project_dir.join(PROJECT_FILE);
        let temporary = project_dir.join("project.json.tmp");
        fs::write(&temporary, serialized)?;
        fs::rename(temporary, target)?;
        Ok(())
    }

    fn project_dir(&self, project_id: &str) -> PathBuf {
        self.projects_root.join(project_id)
    }

    fn validated_project_id(project_id: &str) -> Result<String, CommandError> {
        Uuid::parse_str(project_id)
            .map(|id| id.to_string())
            .map_err(|_| CommandError::new("invalid_project_id", "Project id is not a valid UUID"))
    }
}

#[tauri::command]
pub fn create_project(app: AppHandle, name: String) -> Result<Project, CommandError> {
    FsProjectRepository::from_app(&app)?.create(name)
}

#[tauri::command]
pub fn list_recent_projects(app: AppHandle) -> Result<Vec<ProjectSummary>, CommandError> {
    FsProjectRepository::from_app(&app)?.list_recent()
}

#[tauri::command]
pub fn open_project(app: AppHandle, project_id: String) -> Result<Project, CommandError> {
    FsProjectRepository::from_app(&app)?.open(&project_id)
}
