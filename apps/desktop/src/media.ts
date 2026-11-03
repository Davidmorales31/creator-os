import { invoke } from "@tauri-apps/api/core";

export type MediaKind = "video" | "audio" | "image";
export type MediaAsset = {
  id: string; fileName: string; sourcePath: string; kind: MediaKind; importedAt: string;
  fileSizeBytes: number; durationSeconds: number | null; width: number | null; height: number | null;
  fps: number | null; videoCodec: string | null; audioCodec: string | null; sampleRate: number | null; channels: number | null;
};
export async function importMedia(projectId: string, sourcePath: string): Promise<MediaAsset> { return invoke<MediaAsset>("import_media", { projectId, sourcePath }); }
export async function listProjectMedia(projectId: string): Promise<MediaAsset[]> { return invoke<MediaAsset[]>("list_project_media", { projectId }); }
export async function getMediaPreviewUrl(projectId: string, assetId: string): Promise<string> { return invoke<string>("get_media_preview_url", { projectId, assetId }); }
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024; let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) { value /= 1024; unit = units[index]; }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds)); const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60); const secs = total % 60;
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}` : `${minutes}:${secs.toString().padStart(2, "0")}`;
}
