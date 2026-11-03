import type { MediaAsset } from "./media";
import type { Timeline } from "./timeline";

export type MontageSegment = {
  clipId: string;
  assetId: string;
  timelineStartFrame: number;
  sourceStartFrame: number;
  durationFrames: number;
};
export type MontagePlan = {
  revision: number;
  fps: number;
  totalFrames: number;
  segments: MontageSegment[];
};
export type MontagePlanResult = { ok: true; plan: MontagePlan } | { ok: false; reason: string };

export function planMontage(timeline: Timeline, assets: readonly MediaAsset[], fps: number): MontagePlanResult {
  const reject = (reason: string): MontagePlanResult => ({ ok: false, reason });
  if (!Number.isSafeInteger(fps) || fps < 1 || fps > 120) return reject("FPS del proyecto no válido.");
  if (!timeline.clips.length) return reject("El timeline no tiene clips.");
  const populated = new Set(timeline.clips.map((clip) => clip.trackId));
  if (populated.size !== 1) return reject("La reproducción secuencial admite una sola pista de video con contenido.");
  const trackId = [...populated][0];
  if (!timeline.tracks.some((track) => track.id === trackId && track.kind === "video")) {
    return reject("La pista activa debe ser de video; la mezcla de audio llegará después.");
  }
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const sorted = [...timeline.clips].sort((a, b) => a.startFrame - b.startFrame || a.id.localeCompare(b.id));
  let nextFrame = 0;
  const segments: MontageSegment[] = [];
  for (const clip of sorted) {
    if (clip.kind !== "video" || clip.trackId !== trackId) return reject("El timeline contiene una pista incompatible.");
    if (![clip.startFrame, clip.sourceInFrame, clip.durationFrames].every(Number.isSafeInteger)
      || clip.startFrame < 0 || clip.sourceInFrame < 0 || clip.durationFrames <= 0) {
      return reject("Un clip tiene tiempos inválidos.");
    }
    if (clip.startFrame !== nextFrame) {
      return reject(clip.startFrame > nextFrame
        ? "El montaje contiene un espacio vacío; elimina los huecos antes de reproducir."
        : "El montaje contiene clips superpuestos.");
    }
    const asset = assetsById.get(clip.assetId);
    if (!asset || asset.kind !== "video" || asset.durationSeconds === null
      || !Number.isFinite(asset.durationSeconds) || asset.durationSeconds <= 0) {
      return reject("Un clip no corresponde a un video importado y disponible.");
    }
    const measured = Math.floor(asset.durationSeconds * fps);
    const sourceEnd = clip.sourceInFrame + clip.durationFrames;
    if (!Number.isSafeInteger(sourceEnd) || sourceEnd > measured
      || (clip.sourceLengthFrames !== null && sourceEnd > clip.sourceLengthFrames)) {
      return reject("Un recorte supera la duración real del video original.");
    }
    nextFrame += clip.durationFrames;
    if (!Number.isSafeInteger(nextFrame) || nextFrame > fps * 60 * 60 * 24) {
      return reject("El montaje supera el límite de duración admitido.");
    }
    segments.push({
      clipId: clip.id, assetId: clip.assetId,
      timelineStartFrame: clip.startFrame, sourceStartFrame: clip.sourceInFrame,
      durationFrames: clip.durationFrames,
    });
  }
  return { ok: true, plan: { revision: timeline.revision, fps, totalFrames: nextFrame, segments } };
}

/** Media clock is authoritative; clip end is exclusive. Never use a synthetic animation clock. */
export function montageFrameAtSource(segment: MontageSegment, seconds: number, fps: number): number | null {
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(fps) || fps <= 0) return null;
  const sourceFrame = Math.floor(seconds * fps);
  const offset = sourceFrame - segment.sourceStartFrame;
  if (!Number.isSafeInteger(sourceFrame) || offset < 0 || offset >= segment.durationFrames) return null;
  return segment.timelineStartFrame + offset;
}

export function montageClipEndSeconds(segment: MontageSegment, fps: number): number {
  return (segment.sourceStartFrame + segment.durationFrames) / fps;
}
