import { invoke } from "@tauri-apps/api/core";

export type ExportStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type ExportJob = {
  id: string;
  status: ExportStatus;
  progress: number;
  outputPath: string | null;
  error: string | null;
};

export async function startExport(projectId: string): Promise<ExportJob> {
  return invoke<ExportJob>("start_export", { projectId });
}
export async function getExportStatus(jobId: string): Promise<ExportJob> {
  return invoke<ExportJob>("get_export_status", { jobId });
}
export async function cancelExport(jobId: string): Promise<ExportJob> {
  return invoke<ExportJob>("cancel_export", { jobId });
}
