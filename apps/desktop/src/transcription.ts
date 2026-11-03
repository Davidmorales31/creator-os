import { invoke } from "@tauri-apps/api/core";
export type TranscriptionStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type TranscriptionJob = { id: string; assetId: string; status: TranscriptionStatus; resultId: string | null; error: string | null; errorCode: string | null; };
export type TranscriptSegment = { startMs: number; endMs: number; text: string };
export type TranscriptRecord = { id: string; createdAt: string; assetId: string; model: string; language: string; schemaVersion: number; segments: TranscriptSegment[] };
export type TranscriptionModel = "tiny" | "base" | "small";
export type TranscriptionLanguage = "es" | "en" | "auto";
export function startTranscription(projectId: string, assetId: string, model: TranscriptionModel, language: TranscriptionLanguage, allowDownload: boolean): Promise<TranscriptionJob> {
  return invoke<TranscriptionJob>("start_transcription", { projectId, assetId, model, language, allowDownload });
}
export function getTranscriptionStatus(jobId: string): Promise<TranscriptionJob> { return invoke<TranscriptionJob>("get_transcription_status", { jobId }); }
export function cancelTranscription(jobId: string): Promise<TranscriptionJob> { return invoke<TranscriptionJob>("cancel_transcription", { jobId }); }
export function listTranscripts(projectId: string, assetId: string): Promise<TranscriptRecord[]> { return invoke<TranscriptRecord[]>("list_transcripts", { projectId, assetId }); }
export function transcriptionTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}
