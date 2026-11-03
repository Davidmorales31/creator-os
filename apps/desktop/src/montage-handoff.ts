import type { MontageSegment } from "./montage-plan";

export type HandoffKey = string;
export type HandoffPhase = "seeking" | "playing" | "finished";
export type Handoff = { key: HandoffKey; phase: HandoffPhase };

export function handoffKey(runId: string, index: number): HandoffKey {
  return runId + ":" + index;
}

/** Only the active, successfully started segment can advance. */
export function shouldAdvanceMontage(
  handoff: Handoff | null, expectedKey: HandoffKey, segment: MontageSegment,
  fps: number, mediaSeconds: number, ended: boolean,
): boolean {
  if (!handoff || handoff.key !== expectedKey || handoff.phase !== "playing"
    || !Number.isFinite(fps) || fps <= 0 || !Number.isFinite(mediaSeconds)
    || mediaSeconds < 0 || segment.durationFrames <= 0) return false;
  if (ended) return true;
  return mediaSeconds + 0.0001 >= (segment.sourceStartFrame + segment.durationFrames) / fps;
}

export function canStartAfterSeek(
  handoff: Handoff | null, key: HandoffKey, currentSeconds: number,
  expectedSeconds: number, seeking: boolean, fps: number,
): boolean {
  if (!handoff || handoff.key !== key || handoff.phase !== "seeking"
    || seeking || !Number.isFinite(currentSeconds) || !Number.isFinite(expectedSeconds)
    || !Number.isFinite(fps) || fps <= 0) return false;
  // Video frame quantization may differ by platform; accept within half a frame.
  return Math.abs(currentSeconds - expectedSeconds) <= 0.5 / fps + 0.0001;
}
