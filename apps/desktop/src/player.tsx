import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getMediaPreviewUrl, type MediaAsset } from "./media";

type FitMode = "fit" | "fill";
type MediaPlayerProps = { projectId: string; asset: MediaAsset | null };
function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds)); const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60); const secs = total % 60;
  return hours > 0 ? `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}` : `${minutes}:${secs.toString().padStart(2, "0")}`;
}
export function MediaPlayer({ projectId, asset }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null); const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); const [duration, setDuration] = useState(0); const [fitMode, setFitMode] = useState<FitMode>("fit");
  useEffect(() => {
    let cancelled = false; setSourceUrl(null); setError(null); setPlaying(false); setCurrentTime(0); setDuration(asset?.durationSeconds ?? 0);
    if (!asset || asset.kind !== "video") return () => undefined;
    setLoading(true);
    void getMediaPreviewUrl(projectId, asset.id).then((url) => { if (!cancelled) setSourceUrl(url); })
      .catch((cause: unknown) => { if (!cancelled) setError(typeof cause === "object" && cause !== null && "message" in cause ? String((cause as { message: unknown }).message) : typeof cause === "string" ? cause : "Creator OS could not prepare this preview."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [asset, projectId]);
  async function togglePlayback() {
    const video = videoRef.current; if (!video) return;
    if (video.paused) { try { await video.play(); } catch { setError("Playback could not start. The media codec may not be supported by the system WebView."); } } else { video.pause(); }
  }
  function seekTo(nextTime: number) {
    const video = videoRef.current; if (!video || !Number.isFinite(nextTime)) return;
    const max = Number.isFinite(video.duration) ? video.duration : duration; const clamped = Math.min(Math.max(nextTime, 0), Math.max(max, 0));
    video.currentTime = clamped; setCurrentTime(clamped);
  }
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === " ") { event.preventDefault(); void togglePlayback(); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); seekTo((videoRef.current?.currentTime ?? currentTime) - 5); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); seekTo((videoRef.current?.currentTime ?? currentTime) + 5); }
  }
  if (!asset) return <section className="panel player-panel player-empty" aria-label="Video preview"><span className="eyebrow">Preview</span><div className="player-empty-copy"><strong>Select a video</strong><span>Choose an imported video from the Media library.</span></div></section>;
  if (asset.kind !== "video") return <section className="panel player-panel player-empty" aria-label="Video preview"><span className="eyebrow">Preview</span><div className="player-empty-copy"><strong>{asset.fileName}</strong><span>Video Preview currently supports video assets. Audio and image preview come later.</span></div></section>;
  return <section className="panel player-panel" aria-label={`Preview ${asset.fileName}`} tabIndex={0} onKeyDown={handleKeyDown}>
    <div className="player-heading"><div><span className="eyebrow">Preview</span><strong title={asset.fileName}>{asset.fileName}</strong></div><span className="shortcut-hint">Space · ←/→ 5s</span></div>
    <div className={`video-stage video-stage-${fitMode}`}>
      {loading && <div className="player-overlay">Preparing local preview…</div>}
      {error && <div className="player-overlay player-error">{error}</div>}
      {sourceUrl && <video ref={videoRef} src={sourceUrl} preload="metadata" playsInline onClick={() => void togglePlayback()}
        onLoadedMetadata={(event) => { const nextDuration = event.currentTarget.duration; if (Number.isFinite(nextDuration)) setDuration(nextDuration); }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => setError("This video could not be decoded by the system WebView. Creator OS will add proxy generation for unsupported codecs.")} />}
    </div>
    <div className="player-controls">
      <button type="button" className="player-control-button" onClick={() => void togglePlayback()} disabled={!sourceUrl || Boolean(error)} aria-label={playing ? "Pause" : "Play"}>{playing ? "Pause" : "Play"}</button>
      <input className="player-scrubber" type="range" min={0} max={Math.max(duration, 0)} step={0.01} value={Math.min(currentTime, Math.max(duration, 0))} onChange={(event) => seekTo(Number(event.currentTarget.value))} disabled={!sourceUrl || duration <= 0} aria-label="Seek video" />
      <span className="player-time">{formatClock(currentTime)} / {formatClock(duration)}</span>
      <button type="button" className="secondary-button player-fit-button" onClick={() => setFitMode((mode) => mode === "fit" ? "fill" : "fit")} title="Toggle fit/fill">{fitMode === "fit" ? "Fit" : "Fill"}</button>
    </div>
  </section>;
}
