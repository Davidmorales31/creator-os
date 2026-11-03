import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getMediaPreviewUrl, type MediaAsset } from "./media";
import { listTranscripts, type TranscriptRecord } from "./transcription";
import { captionAt, eligibleCaptions } from "./caption-cues";
import { normalizeCommandError } from "./projects";
import type { TimelinePreviewTarget } from "./timeline-preview";
import { handoffKey, shouldAdvanceMontage, canStartAfterSeek, type Handoff } from "./montage-handoff";
import type { MontageSession } from "./montage-session";

type FitMode = "fit" | "fill";
type MediaPlayerProps = { projectId: string; asset: MediaAsset | null; captionRevision?: number;
  previewRequest?: (TimelinePreviewTarget & { requestId: number }) | null;
  onSourceTimeChange?: (seconds: number) => void;
  montageSession?: MontageSession | null;
  onMontageFinished?: (runId: string, index: number) => void;
  onMontageError?: (message: string) => void;
};
function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds)); const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60); const secs = total % 60;
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}` : `${minutes}:${secs.toString().padStart(2, "0")}`;
}
export function MediaPlayer({ projectId, asset, captionRevision = 0, previewRequest, onSourceTimeChange, montageSession, onMontageFinished, onMontageError }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readySourceAsset = useRef<string | null>(null);
  const montageHandoffRef = useRef<Handoff | null>(null);
  const latestMontageRef = useRef(montageSession);
  const montageFinishedRef = useRef(onMontageFinished);
  const montageErrorRef = useRef(onMontageError);
  latestMontageRef.current = montageSession;
  montageFinishedRef.current = onMontageFinished;
  montageErrorRef.current = onMontageError;
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsError, setCaptionsError] = useState<string | null>(null);
  const [sourceRecord, setSourceRecord] = useState<{ assetId: string; url: string } | null>(null);
  const sourceUrl = sourceRecord?.assetId === asset?.id ? sourceRecord.url : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); const [duration, setDuration] = useState(0); const [fitMode, setFitMode] = useState<FitMode>("fit");
  useEffect(() => {
    let cancelled = false; readySourceAsset.current = null; setSourceRecord(null); setError(null); setPlaying(false); setCurrentTime(0); setDuration(asset?.durationSeconds ?? 0);
    if (!asset || asset.kind !== "video") return () => undefined;
    setLoading(true);
    void getMediaPreviewUrl(projectId, asset.id).then((url) => { if (!cancelled) setSourceRecord({ assetId: asset.id, url }); })
      .catch((cause: unknown) => { if (!cancelled) setError(typeof cause === "object" && cause !== null && "message" in cause ? String((cause as { message: unknown }).message) : typeof cause === "string" ? cause : "Creator OS could not prepare this preview."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [asset, projectId]);
  const selectedTranscript = transcripts.find((record) => record.id === selectedTranscriptId) ?? null;
  const activeCaption = captionsEnabled && selectedTranscript && eligibleCaptions(selectedTranscript.segments)
    ? captionAt(selectedTranscript.segments, currentTime) : null;

  useEffect(() => {
    let alive = true;
    setTranscripts([]);
    setSelectedTranscriptId(null);
    setCaptionsEnabled(false);
    setCaptionsError(null);
    if (!asset || asset.kind !== "video") return () => { alive = false; };
    return () => { alive = false; };
  }, [projectId, asset?.id, asset?.kind]);

  useEffect(() => {
    let alive = true;
    if (!asset || asset.kind !== "video") return () => { alive = false; };
    setCaptionsLoading(true);
    setCaptionsError(null);
    void listTranscripts(projectId, asset.id).then((found) => {
      if (!alive) return;
      const available = found.filter((record) => eligibleCaptions(record.segments));
      setTranscripts(available);
      setSelectedTranscriptId((current) => available.some((record) => record.id === current)
        ? current : available[0]?.id ?? null);
    }).catch((cause: unknown) => {
      if (alive) setCaptionsError(normalizeCommandError(cause).message);
    }).finally(() => { if (alive) setCaptionsLoading(false); });
    return () => { alive = false; };
  }, [projectId, asset?.id, asset?.kind, captionRevision]);

  function completeMontageSeek(video: HTMLVideoElement) {
    if (videoRef.current !== video) return;
    const session = latestMontageRef.current;
    if (!session) return;
    const clip = session.plan.segments[session.index];
    if (clip.assetId !== asset?.id || readySourceAsset.current !== clip.assetId) return;
    const key = handoffKey(session.runId, session.index);
    const expected = clip.sourceStartFrame / session.plan.fps;
    if (!canStartAfterSeek(montageHandoffRef.current, key, video.currentTime,
      expected, video.seeking, session.plan.fps)) return;
    montageHandoffRef.current = { key, phase: "playing" };
    void video.play().catch(() => {
      if (latestMontageRef.current?.runId === session.runId
        && montageHandoffRef.current?.key === key) {
        montageHandoffRef.current = { key, phase: "finished" };
        montageErrorRef.current?.("No fue posible reproducir este clip. Comprueba el códec en la WebView del sistema.");
      }
    });
  }
  function activateMontage(video: HTMLVideoElement, assetId: string) {
    const session = latestMontageRef.current;
    if (!session || videoRef.current !== video || readySourceAsset.current !== assetId
      || video.readyState < 1) return;
    const clip = session.plan.segments[session.index];
    if (clip.assetId !== assetId) return;
    const key = handoffKey(session.runId, session.index);
    if (montageHandoffRef.current?.key === key) return;
    montageHandoffRef.current = { key, phase: "seeking" };
    const seek = clip.sourceStartFrame / session.plan.fps;
    video.pause();
    video.currentTime = seek;
    setCurrentTime(seek);
    onSourceTimeChange?.(seek);
    completeMontageSeek(video);
  }
  function checkMontageBoundary(video: HTMLVideoElement, ended = false) {
    if (videoRef.current !== video) return;
    const session = latestMontageRef.current;
    if (!session || readySourceAsset.current !== asset?.id) return;
    const segment = session.plan.segments[session.index];
    if (segment.assetId !== asset?.id) return;
    const key = handoffKey(session.runId, session.index);
    if (!shouldAdvanceMontage(montageHandoffRef.current, key, segment,
      session.plan.fps, video.currentTime, ended)) return;
    montageHandoffRef.current = { key, phase: "finished" };
    video.pause();
    montageFinishedRef.current?.(session.runId, session.index);
  }
  useEffect(() => {
    if (!montageSession) {
      montageHandoffRef.current = null;
      videoRef.current?.pause();
      return;
    }
    const video = videoRef.current;
    if (video && asset?.id === montageSession.plan.segments[montageSession.index].assetId) {
      activateMontage(video, asset.id);
    }
  }, [montageSession, asset?.id, sourceUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewRequest || readySourceAsset.current !== previewRequest.assetId
      || asset?.id !== previewRequest.assetId || video.readyState < 1) return;
    video.pause(); // Scrubbing a clip does not pretend to play the whole montage.
    const maximum = Number.isFinite(video.duration) ? video.duration : (asset.durationSeconds ?? 0);
    const seconds = Math.min(Math.max(previewRequest.sourceSeconds, 0), Math.max(maximum, 0));
    video.currentTime = seconds;
    setCurrentTime(seconds);
    onSourceTimeChange?.(seconds);
  }, [previewRequest, asset?.id]);

  async function togglePlayback() {
    const video = videoRef.current; if (!video || montageSession) return;
    if (video.paused) { try { await video.play(); } catch { setError("Playback could not start. The media codec may not be supported by the system WebView."); } } else { video.pause(); }
  }
  function seekTo(nextTime: number) {
    const video = videoRef.current; if (!video || montageSession || !Number.isFinite(nextTime)) return;
    const max = Number.isFinite(video.duration) ? video.duration : duration; const clamped = Math.min(Math.max(nextTime, 0), Math.max(max, 0));
    video.currentTime = clamped; setCurrentTime(clamped); onSourceTimeChange?.(clamped);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === " ") { event.preventDefault(); void togglePlayback(); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); seekTo((videoRef.current?.currentTime ?? currentTime) - 5); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); seekTo((videoRef.current?.currentTime ?? currentTime) + 5); }
  }
  if (!asset) return <section className="panel player-panel player-empty" aria-label="Video preview"><span className="eyebrow">Preview</span><div className="player-empty-copy"><strong>Select a video</strong><span>Choose an imported video from the Media library.</span></div></section>;
  if (asset.kind !== "video") return <section className="panel player-panel player-empty" aria-label="Video preview"><span className="eyebrow">Preview</span><div className="player-empty-copy"><strong>{asset.fileName}</strong><span>Video Preview currently supports video assets. Audio and image preview come later.</span></div></section>;
  return <section className="panel player-panel" aria-label={`Preview ${asset.fileName}`} tabIndex={0} onKeyDown={handleKeyDown}>
    <div className="player-heading"><div><span className="eyebrow">{montageSession ? "Preview · montaje secuencial" : previewRequest?.assetId === asset.id ? "Preview · clip del timeline" : "Preview · archivo original"}</span><strong title={asset.fileName}>{asset.fileName}</strong></div><span className="shortcut-hint">Space · ←/→ 5s</span></div>
    <div className={`video-stage video-stage-${fitMode}`}>
      {loading && <div className="player-overlay">Preparing local preview…</div>}
      {error && <div className="player-overlay player-error">{error}</div>}
      {sourceUrl && <video key={projectId + ":" + asset.id + ":" + sourceUrl} ref={videoRef} src={sourceUrl} preload="metadata" playsInline onClick={() => void togglePlayback()}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (videoRef.current !== video) return;
          const nextDuration = video.duration;
          readySourceAsset.current = asset.id;
          if (latestMontageRef.current) activateMontage(video, asset.id);
          if (Number.isFinite(nextDuration)) setDuration(nextDuration);
          if (previewRequest?.assetId === asset.id) {
            const requestedTime = Math.min(Math.max(previewRequest.sourceSeconds, 0), Number.isFinite(nextDuration) ? nextDuration : (asset.durationSeconds ?? 0));
            video.currentTime = requestedTime;
            setCurrentTime(requestedTime);
            onSourceTimeChange?.(requestedTime);
          }
        }}
        onTimeUpdate={(event) => { if (videoRef.current !== event.currentTarget) return; setCurrentTime(event.currentTarget.currentTime); onSourceTimeChange?.(event.currentTarget.currentTime); checkMontageBoundary(event.currentTarget); }}
        onSeeked={(event) => { if (videoRef.current !== event.currentTarget) return; setCurrentTime(event.currentTarget.currentTime); onSourceTimeChange?.(event.currentTarget.currentTime); completeMontageSeek(event.currentTarget); checkMontageBoundary(event.currentTarget); }} onPlay={(event) => { if (videoRef.current === event.currentTarget) setPlaying(true); }} onPause={(event) => { if (videoRef.current === event.currentTarget) setPlaying(false); }} onEnded={(event) => { if (videoRef.current !== event.currentTarget) return; setPlaying(false); checkMontageBoundary(event.currentTarget, true); }}
        onError={(event) => { if (videoRef.current !== event.currentTarget) return; setError("This video could not be decoded by the system WebView. Creator OS will add proxy generation for unsupported codecs."); if (latestMontageRef.current) montageErrorRef.current?.("No se pudo decodificar un clip del montaje."); }} />}
      {activeCaption && <div className="caption-overlay" aria-label="Subtítulos de previsualización"><span className="caption-text">{activeCaption.text}</span></div>}
    </div>
    <div className="player-controls">
      <button type="button" className="player-control-button" onClick={() => void togglePlayback()} disabled={Boolean(montageSession) || !sourceUrl || Boolean(error)} aria-label={playing ? "Pause" : "Play"}>{playing ? "Pause" : "Play"}</button>
      <input className="player-scrubber" type="range" min={0} max={Math.max(duration, 0)} step={0.01} value={Math.min(currentTime, Math.max(duration, 0))} onChange={(event) => seekTo(Number(event.currentTarget.value))} disabled={Boolean(montageSession) || !sourceUrl || duration <= 0} aria-label="Seek video" />
      <span className="player-time">{formatClock(currentTime)} / {formatClock(duration)}</span>
      <button type="button" className="secondary-button player-fit-button" onClick={() => setFitMode((mode) => mode === "fit" ? "fill" : "fit")} title="Toggle fit/fill">{fitMode === "fit" ? "Fit" : "Fill"}</button>
    </div>
    <div className="caption-controls" role="group" aria-label="Opciones de subtítulos">
      <button type="button" className="secondary-button caption-toggle"
        aria-pressed={captionsEnabled}
        aria-label={captionsEnabled ? "Ocultar subtítulos" : "Mostrar subtítulos"}
        onClick={() => setCaptionsEnabled((enabled) => !enabled)}
        disabled={captionsLoading || transcripts.length === 0}>
        {captionsEnabled ? "CC activados" : "CC desactivados"}
      </button>
      {transcripts.length > 0 && <label className="caption-version">
        Versión
        <select aria-label="Versión de subtítulos" value={selectedTranscriptId ?? ""}
          onChange={(event) => setSelectedTranscriptId(event.target.value)}>
          {transcripts.map((record, index) => (
            <option key={record.id} value={record.id}>
              {index === 0 ? "Más reciente" : "Versión " + (index + 1)} · {record.language} · {record.model}
            </option>
          ))}
        </select>
      </label>}
      {captionsLoading && <span className="caption-status" role="status">Buscando transcripciones locales…</span>}
      {!captionsLoading && transcripts.length === 0 && !captionsError && <span className="caption-status">Sin transcripciones disponibles</span>}
      {captionsError && <span className="caption-error" role="alert">{captionsError}</span>}
    </div>
  </section>;
}
