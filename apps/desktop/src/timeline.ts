import { invoke } from "@tauri-apps/api/core";

export type TrackKind = "video" | "audio";
export type TimelineTrack = { id: string; name: string; kind: TrackKind };
export type TimelineClip = {
  id: string;
  assetId: string;
  trackId: string;
  kind: TrackKind;
  startFrame: number;
  sourceInFrame: number;
  durationFrames: number;
  sourceLengthFrames: number | null;
};
export type Timeline = {
  schemaVersion: number;
  revision: number;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  undoStack: { tracks: TimelineTrack[]; clips: TimelineClip[] }[];
  redoStack: { tracks: TimelineTrack[]; clips: TimelineClip[] }[];
};
export type TimelineOperation =
  | { type: "addTrack"; track: TimelineTrack }
  | { type: "addClip"; clip: TimelineClip }
  | { type: "moveClip"; clipId: string; trackId: string; startFrame: number }
  | { type: "splitClip"; clipId: string; rightClipId: string; atFrame: number }
  | { type: "trimClip"; clipId: string; startFrame: number; sourceInFrame: number; durationFrames: number }
  | { type: "deleteClip"; clipId: string };
export type TimelineEdit = { action: "apply"; operation: TimelineOperation } | { action: "undo" } | { action: "redo" };

export async function getTimeline(projectId: string): Promise<Timeline> {
  return invoke<Timeline>("get_timeline", { projectId });
}
export async function editTimeline(projectId: string, expectedRevision: number, command: TimelineEdit): Promise<Timeline> {
  return invoke<Timeline>("edit_timeline", { projectId, expectedRevision, command });
}
export const emptyTimeline = (): Timeline => ({
  schemaVersion: 1, revision: 0,
  tracks: [{ id: "video-1", name: "Video 1", kind: "video" }, { id: "audio-1", name: "Audio 1", kind: "audio" }],
  clips: [], undoStack: [], redoStack: [],
});
