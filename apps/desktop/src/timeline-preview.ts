import type { Timeline, TimelineClip } from "./timeline";

export type TimelinePreviewTarget = {
  clipId: string;
  assetId: string;
  timelineFrame: number;
  clipStartFrame: number;
  sourceInFrame: number;
  durationFrames: number;
  sourceSeconds: number;
};

const validFrame = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

export function previewClipAt(clip: TimelineClip, absoluteFrame: number, fps: number): TimelinePreviewTarget | null {
  if (clip.kind !== "video" || !clip.assetId || !clip.id || !validFrame(absoluteFrame)
    || !validFrame(clip.startFrame) || !validFrame(clip.sourceInFrame)
    || !validFrame(clip.durationFrames) || clip.durationFrames === 0
    || !Number.isSafeInteger(fps) || fps < 1 || fps > 120) return null;
  const offset = absoluteFrame - clip.startFrame;
  if (offset < 0 || offset >= clip.durationFrames) return null;
  const sourceFrame = clip.sourceInFrame + offset;
  if (!Number.isSafeInteger(sourceFrame)) return null;
  return {
    clipId: clip.id, assetId: clip.assetId, timelineFrame: absoluteFrame,
    clipStartFrame: clip.startFrame, sourceInFrame: clip.sourceInFrame,
    durationFrames: clip.durationFrames, sourceSeconds: sourceFrame / fps,
  };
}

/** The first configured video track has precedence. Later video tracks are not composited. */
export function previewAtFrame(timeline: Timeline, frame: number, fps: number): TimelinePreviewTarget | null {
  if (!validFrame(frame)) return null;
  const videoTracks = timeline.tracks.filter((track) => track.kind === "video");
  for (const track of videoTracks) {
    const clips = timeline.clips.filter((clip) => clip.trackId === track.id && clip.kind === "video");
    // Invalid overlaps are normally rejected by the Rust domain. Resolve malformed data deterministically.
    clips.sort((a, b) => a.startFrame - b.startFrame || a.id.localeCompare(b.id));
    for (const clip of clips) {
      const mapped = previewClipAt(clip, frame, fps);
      if (mapped) return mapped;
    }
  }
  return null;
}

/** Tracks the actual media clock while it remains inside the selected clip's source interval. */
export function timelineFrameFromSource(target: TimelinePreviewTarget, seconds: number, fps: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(fps) || fps < 1 || fps > 120) return null;
  const frame = Math.floor(seconds * fps);
  if (!Number.isSafeInteger(frame)) return null;
  const offset = frame - target.sourceInFrame;
  if (offset < 0 || offset >= target.durationFrames) return null;
  const result = target.clipStartFrame + offset;
  return Number.isSafeInteger(result) ? result : null;
}
