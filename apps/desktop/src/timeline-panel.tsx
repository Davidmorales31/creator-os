import { useEffect, useMemo, useState } from "react";
import { formatDuration, type MediaAsset } from "./media";
import { normalizeCommandError } from "./projects";
import { editTimeline, getTimeline, type Timeline, type TimelineClip, type TimelineEdit, type TrackKind } from "./timeline";

type Props = {
  projectId: string;
  fps: number;
  mediaAssets: MediaAsset[];
  selectedAsset: MediaAsset | null;
  onError: (message: string) => void;
};

const PIXELS_PER_SECOND = 24;
const MIN_VISUAL_SECONDS = 20;
const snap = (seconds: number, fps: number) => Math.max(0, Math.round(seconds * fps));
const time = (frames: number, fps: number) => formatDuration(frames / fps);

function lastFrame(clips: TimelineClip[], trackId: string) {
  return clips.filter((c) => c.trackId === trackId).reduce((max, c) => Math.max(max, c.startFrame + c.durationFrames), 0);
}

export function TimelinePanel({ projectId, fps, mediaAssets, selectedAsset, onError }: Props) {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [cursorSeconds, setCursorSeconds] = useState(0);

  useEffect(() => {
    let disposed = false;
    setTimeline(null);
    setSelectedClipId(null);
    void getTimeline(projectId).then((value) => {
      if (!disposed) setTimeline(value);
    }).catch((cause: unknown) => {
      if (!disposed) onError(normalizeCommandError(cause).message);
    });
    return () => { disposed = true; };
    // Error presentation is intentionally owned by the parent; avoid reloading the model on re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const selectedClip = timeline?.clips.find((c) => c.id === selectedClipId) ?? null;
  const assetNames = useMemo(() => new Map(mediaAssets.map((asset) => [asset.id, asset.fileName])), [mediaAssets]);
  const totalFrames = timeline?.clips.reduce((max, clip) => Math.max(max, clip.startFrame + clip.durationFrames), 0) ?? 0;
  const width = Math.max(MIN_VISUAL_SECONDS * PIXELS_PER_SECOND, (totalFrames / fps + 5) * PIXELS_PER_SECOND);
  const canEdit = Boolean(timeline) && !busy;

  async function dispatch(command: TimelineEdit, keepId?: string | null) {
    if (!timeline || busy) return;
    setBusy(true);
    try {
      const updated = await editTimeline(projectId, timeline.revision, command);
      setTimeline(updated);
      setSelectedClipId(keepId === undefined ? selectedClipId : keepId);
    } catch (cause: unknown) {
      const error = normalizeCommandError(cause);
      onError(error.message);
      if (error.code === "stale_timeline_revision") {
        try { setTimeline(await getTimeline(projectId)); } catch { /* Surface original error. */ }
      }
    } finally { setBusy(false); }
  }

  function addAsset() {
    if (!timeline || !selectedAsset || !Number.isFinite(fps) || fps <= 0) return;
    const kind: TrackKind = selectedAsset.kind === "audio" ? "audio" : "video";
    const track = timeline.tracks.find((t) => t.kind === kind);
    if (!track) return;
    const sourceFrames = selectedAsset.durationSeconds !== null ? Math.floor(selectedAsset.durationSeconds * fps) : null;
    const length = selectedAsset.kind === "image" ? snap(5, fps) : sourceFrames;
    if (!length || length < 1) { onError("Este archivo no tiene una duración válida para la línea de tiempo."); return; }
    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      assetId: selectedAsset.id,
      kind,
      trackId: track.id,
      startFrame: lastFrame(timeline.clips, track.id),
      sourceInFrame: 0,
      durationFrames: length,
      sourceLengthFrames: selectedAsset.kind === "image" ? null : sourceFrames,
    };
    void dispatch({ action: "apply", operation: { type: "addClip", clip } }, clip.id);
  }

  function move(byFrames: number, trackId = selectedClip?.trackId) {
    if (!selectedClip || !trackId) return;
    const startFrame = Math.max(0, selectedClip.startFrame + byFrames);
    void dispatch({ action: "apply", operation: { type: "moveClip", clipId: selectedClip.id, trackId, startFrame } });
  }
  function split() {
    if (!selectedClip || selectedClip.durationFrames < 2) return;
    const splitAt = selectedClip.startFrame + Math.floor(selectedClip.durationFrames / 2);
    const rightId = crypto.randomUUID();
    void dispatch({ action: "apply", operation: { type: "splitClip", clipId: selectedClip.id, rightClipId: rightId, atFrame: splitAt } }, rightId);
  }
  function trimStart() {
    if (!selectedClip || selectedClip.durationFrames <= fps) return;
    void dispatch({ action: "apply", operation: {
      type: "trimClip", clipId: selectedClip.id,
      startFrame: selectedClip.startFrame + fps,
      sourceInFrame: selectedClip.sourceInFrame + fps,
      durationFrames: selectedClip.durationFrames - fps,
    } });
  }
  function trimEnd() {
    if (!selectedClip || selectedClip.durationFrames <= fps) return;
    void dispatch({ action: "apply", operation: {
      type: "trimClip", clipId: selectedClip.id,
      startFrame: selectedClip.startFrame,
      sourceInFrame: selectedClip.sourceInFrame,
      durationFrames: selectedClip.durationFrames - fps,
    } });
  }

  return (
    <section className="panel timeline-live" aria-label="Línea de tiempo">
      <div className="timeline-toolbar">
        <div><span className="eyebrow">EDICIÓN NO DESTRUCTIVA</span><h2>Timeline <span className="timeline-count">{timeline?.clips.length ?? 0} clips</span></h2></div>
        <div className="timeline-tools">
          <button type="button" className="button button-primary" onClick={addAsset} disabled={!canEdit || !selectedAsset} title="Añadir el medio seleccionado a su pista">+ Añadir clip</button>
          <button type="button" className="secondary-button" onClick={() => void dispatch({ action: "undo" }, null)} disabled={!canEdit || (timeline?.undoStack.length ?? 0) === 0} title="Deshacer último cambio">↶ Deshacer</button>
          <button type="button" className="secondary-button" onClick={() => void dispatch({ action: "redo" }, null)} disabled={!canEdit || (timeline?.redoStack.length ?? 0) === 0} title="Rehacer último cambio">↷ Rehacer</button>
        </div>
      </div>
      <div className="timeline-operations" aria-label="Operaciones del clip seleccionado">
        <button type="button" className="secondary-button" onClick={() => move(-fps)} disabled={!canEdit || !selectedClip} title="Mover un segundo a la izquierda">← 1 s</button>
        <button type="button" className="secondary-button" onClick={() => move(fps)} disabled={!canEdit || !selectedClip} title="Mover un segundo a la derecha">1 s →</button>
        <button type="button" className="secondary-button" onClick={split} disabled={!canEdit || !selectedClip || selectedClip.durationFrames < 2} title="Dividir el clip por la mitad">Dividir</button>
        <button type="button" className="secondary-button" onClick={trimStart} disabled={!canEdit || !selectedClip || selectedClip.durationFrames <= fps}>Recortar inicio −1 s</button>
        <button type="button" className="secondary-button" onClick={trimEnd} disabled={!canEdit || !selectedClip || selectedClip.durationFrames <= fps}>Recortar fin −1 s</button>
        <button type="button" className="secondary-button timeline-delete" onClick={() => selectedClip && void dispatch({ action: "apply", operation: { type: "deleteClip", clipId: selectedClip.id } }, null)} disabled={!canEdit || !selectedClip}>Eliminar</button>
      </div>
      {selectedClip && timeline && (
        <div className="timeline-selection">
          <span>Seleccionado: {assetNames.get(selectedClip.assetId) ?? selectedClip.assetId}</span>
          <label>Posición (s) <input type="number" min={0} step={1 / fps} value={Number((selectedClip.startFrame / fps).toFixed(3))}
            onChange={(event) => { const value = Number(event.target.value); if (Number.isFinite(value)) move(snap(value, fps) - selectedClip.startFrame); }} disabled={!canEdit} /></label>
          <label>Pista <select value={selectedClip.trackId} onChange={(event) => move(0, event.target.value)} disabled={!canEdit}>
            {timeline.tracks.filter((track) => track.kind === selectedClip.kind).map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
          </select></label>
        </div>
      )}
      <div className="timeline-canvas" role="group" aria-label="Pistas">
        <div className="timeline-track-labels">
          <div className="timeline-ruler-label">TIME</div>
          {timeline?.tracks.map((track) => <div className="timeline-track-label" key={track.id}>{track.name}</div>)}
        </div>
        <div className="timeline-scroller">
          <div className="timeline-tracks" style={{ width }}>
            <div className="timeline-ruler-live">
              {Array.from({ length: Math.ceil(width / (PIXELS_PER_SECOND * 5)) + 1 }, (_, i) => (
                <button key={i} type="button" className="timeline-tick" style={{ left: i * 5 * PIXELS_PER_SECOND }}
                  onClick={() => setCursorSeconds(i * 5)} title={"Mover cursor a " + i * 5 + " segundos"}>{time(i * 5 * fps, fps)}</button>
              ))}
            </div>
            {timeline?.tracks.map((track) => (
              <div className="timeline-lane" key={track.id} aria-label={track.name}>
                {timeline.clips.filter((clip) => clip.trackId === track.id).map((clip) => (
                  <button key={clip.id} type="button" className={`timeline-clip timeline-clip-${track.kind} ${selectedClipId === clip.id ? "timeline-clip-selected" : ""}`}
                    aria-pressed={selectedClipId === clip.id} style={{ left: clip.startFrame / fps * PIXELS_PER_SECOND, width: Math.max(8, clip.durationFrames / fps * PIXELS_PER_SECOND) }}
                    title={assetNames.get(clip.assetId) ?? clip.assetId} onClick={() => setSelectedClipId(clip.id)}>
                    <strong>{assetNames.get(clip.assetId) ?? "Medio"}</strong><small>{time(clip.durationFrames, fps)}</small>
                  </button>
                ))}
              </div>
            ))}
            <div className="timeline-playhead" style={{ left: cursorSeconds * PIXELS_PER_SECOND }} aria-hidden="true" />
          </div>
        </div>
      </div>
      {!timeline ? <p className="timeline-help">Cargando timeline…</p> : timeline.clips.length === 0 ?
        <p className="timeline-help">Selecciona un video o audio de la biblioteca y pulsa “Añadir clip”. Los archivos originales no se modifican.</p> :
        <p className="timeline-help">Selecciona un clip para moverlo, dividirlo o recortarlo. Los cambios se guardan en el proyecto. Revisión {timeline.revision}.</p>}
    </section>
  );
}
