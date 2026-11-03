import { invoke } from "@tauri-apps/api/core";

export type ProjectSettings = {
  width: number;
  height: number;
  fps: number;
};

import type { Timeline } from "./timeline";

export type Project = {
  schemaVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  timeline?: Timeline;
};

export type ProjectSummary = Pick<Project, "id" | "name" | "updatedAt">;

export type CreatorCommandError = {
  code: string;
  message: string;
};

export async function createProject(name: string): Promise<Project> {
  return invoke<Project>("create_project", { name });
}

export async function listRecentProjects(): Promise<ProjectSummary[]> {
  return invoke<ProjectSummary[]>("list_recent_projects");
}

export async function openProject(projectId: string): Promise<Project> {
  return invoke<Project>("open_project", { projectId });
}

export function normalizeCommandError(error: unknown): CreatorCommandError {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message: unknown }).message);
    const code = "code" in error ? String((error as { code: unknown }).code) : "unknown_error";
    return { code, message };
  }

  return {
    code: "unknown_error",
    message: typeof error === "string" ? error : "Unexpected Creator OS error",
  };
}
