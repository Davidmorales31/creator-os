use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const PROJECT_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            width: 1920,
            height: 1080,
            fps: 30,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub settings: ProjectSettings,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub updated_at: String,
}

#[derive(Debug, Error, PartialEq)]
pub enum ProjectValidationError {
    #[error("project name cannot be empty")]
    EmptyName,
    #[error("project id cannot be empty")]
    EmptyId,
}

impl Project {
    pub fn create(
        id: impl Into<String>,
        name: impl Into<String>,
        now: impl Into<String>,
    ) -> Result<Self, ProjectValidationError> {
        let id = id.into();
        let name = name.into().trim().to_owned();
        let now = now.into();

        if id.trim().is_empty() {
            return Err(ProjectValidationError::EmptyId);
        }
        if name.is_empty() {
            return Err(ProjectValidationError::EmptyName);
        }

        Ok(Self {
            schema_version: PROJECT_SCHEMA_VERSION,
            id,
            name,
            created_at: now.clone(),
            updated_at: now,
            settings: ProjectSettings::default(),
        })
    }

    pub fn summary(&self) -> ProjectSummary {
        ProjectSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            updated_at: self.updated_at.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_a_versioned_project_with_defaults() {
        let project = Project::create("project-1", "Interstellar", "2026-11-03T10:00:00Z")
            .expect("project should be valid");

        assert_eq!(project.schema_version, PROJECT_SCHEMA_VERSION);
        assert_eq!(project.name, "Interstellar");
        assert_eq!(project.settings.width, 1920);
        assert_eq!(project.settings.height, 1080);
        assert_eq!(project.settings.fps, 30);
    }

    #[test]
    fn rejects_blank_project_names() {
        let error = Project::create("project-1", "   ", "2026-11-03T10:00:00Z")
            .expect_err("blank names must fail");

        assert_eq!(error, ProjectValidationError::EmptyName);
    }
}
