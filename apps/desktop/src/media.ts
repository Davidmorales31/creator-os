import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type MediaKind = "video" | "audio" | "image";

export type MediaAsset = {
  id: string;
  fileName: string;
  sourcePath: string;
  kind: MediaKind;
  fileSizeBytes: number;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  sampleRate: number | null;
  channels: number | null;
  importedAt: string;
};

export async function pickMediaFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [
      {
        name: "Media",
        extensions: [
          "mp4", "mov", "mkv", "webm", "m4v", "avi",
          "mp3", "wav", "m4a", "aac", "flac", "ogg",
          "jpg", "jpeg", "png", "webp", "bmp", "tif", "tiff", "avif", "heic",
        ],
      },
    ],
  });

  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function importMedia(projectId: string, sourcePath: string): Promise<MediaAsset> {
  return invoke<MediaAsset>("import_media", { projectId, sourcePath });
}

export async function listProjectMedia(projectId: string): Promise<MediaAsset[]> {
  return invoke<MediaAsset[]>("list_project_media", { projectId });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${unit}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}
