import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { formatDuration, prepareMediaPreview, type MediaAsset } from "./media";

export type PreviewFit = "contain" | "cover";

type MediaPreviewProps = {
  projectId: string | null;
  asset: MediaAsset | null;
};

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}

export function MediaPreview({ projectId, asset }: MediaPreviewProps) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fit, setFit] = useState<PreviewFit>("contain");

  const isTimedMedia = asset?.kind === "video" || asset?.kind === "audio";
  const displayDuration = useMemo(() => {
    if (!asset) return 0;
    if (duration > 0 && Number.isFinite(duration)) return duration;
    return asset.durationSeconds ?? 0;
  }, [asset, duration]);

  useEffect(() => {
    let cancelled = false;
    setSourceUrl(null);
    setPlaybackError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(asset?.durationSeconds ?? 0);

    if (!projectId || !asset) return;

    setLoading(true);
    void prepareMediaPreview(projectId, asset.id)
      .then((url) => {
        if (!cancelled) setSourceUrl(url);
      })
      .catch((error: unknown) => {
        if (!cancelled) setPlaybackError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      mediaRef.current?.pause();
    };
  }, [projectId, asset?.id]);

  async function togglePlayback() {
    const media = mediaRef.current;
    if (!media) return;

    if (media.paused) {
      try {
        await media.play();
      } catch (error) {
        setPlaybackError(errorMessage(error));
      }
    } else {
      media.pause();
    }
  }

  function seekTo(seconds: number) {
    const media = mediaRef.current;
    if (!media || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(media.duration) ? media.duration : displayDuration;
    media.currentTime = Math.min(Math.max(0, seconds), Math.max(0, max));
  }

  useEffect(() => {
    if (!asset || !isTimedMedia) return;

    function handleKeydown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (event.code === "Space") {
        event.preventDefault();
        void togglePlayback();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekTo((mediaRef.current?.currentTime ?? 0) - 5);
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        seekTo((mediaRef.current?.currentTime ?? 0) + 5);
      } else if (event.code === "KeyF" && asset.kind === "video") {
        event.preventDefault();
        setFit((value) => (value === "contain" ? "cover" : "contain"));
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [asset?.id, isTimedMedia, displayDuration]);

  function attachMedia(element: HTMLMediaElement | null) {
    mediaRef.current = element;
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLMediaElement>) {
    const media = event.currentTarget;
    if (Number.isFinite(media.duration) && media.duration > 0) setDuration(media.duration);
  }

  function handleMediaError(event: SyntheticEvent<HTMLMediaElement>) {
    const code = event.currentTarget.error?.code;
    const message = code
      ? `The WebView could not decode this file (media error ${code}). The asset is still available to Creator OS; a proxy/transcode pipeline can handle unsupported codecs later.`
      : "The WebView could not load this media file.";
    setPlaybackError(message);
  }

  if (!asset) {
    return (
      <section className="preview-shell panel" aria-label="Media preview">
        <div className="preview-empty">
          <span className="eyebrow">Preview</span>
          <h2>Select media</h2>
          <p>Choose an item from the project library to preview it here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="preview-shell panel" aria-label={`Preview ${asset.fileName}`}>
      <div className="preview-toolbar">
        <div className="preview-title">
          <span className={`media-kind media-kind-${asset.kind}`}>{asset.kind.slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{asset.fileName}</strong>
            <small>{asset.kind}{asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}</small>
          </span>
        </div>
        {asset.kind === "video" && (
          <button className="secondary-button" type="button" onClick={() => setFit((value) => (value === "contain" ? "cover" : "contain"))}>
            {fit === "contain" ? "Fit" : "Fill"}
          </button>
        )}
      </div>

      <div className={`preview-stage preview-stage-${asset.kind}`}>
        {loading && <div className="preview-message">Preparing local preview…</div>}
        {!loading && playbackError && <div className="preview-message preview-error">{playbackError}</div>}
        {!loading && !playbackError && sourceUrl && asset.kind === "video" && (
          <video
            ref={attachMedia}
            src={sourceUrl}
            className="preview-video"
            style={{ objectFit: fit }}
            preload="metadata"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={handleMediaError}
          />
        )}
        {!loading && !playbackError && sourceUrl && asset.kind === "audio" && (
          <div className="audio-preview-card">
            <div className="audio-glyph" aria-hidden="true">◖ ))</div>
            <strong>{asset.fileName}</strong>
            <small>{asset.audioCodec ?? "audio"}{asset.sampleRate ? ` · ${asset.sampleRate / 1000} kHz` : ""}</small>
            <audio
              ref={attachMedia}
              src={sourceUrl}
              preload="metadata"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onError={handleMediaError}
            />
          </div>
        )}
        {!loading && !playbackError && sourceUrl && asset.kind === "image" && (
          <img className="preview-image" src={sourceUrl} alt={asset.fileName} style={{ objectFit: fit }} />
        )}
      </div>

      {isTimedMedia && !playbackError && sourceUrl && (
        <div className="transport" aria-label="Playback controls">
          <button type="button" className="transport-button" onClick={() => void togglePlayback()} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? "Pause" : "Play"}
          </button>
          <span className="timecode">{formatDuration(currentTime)}</span>
          <input
            className="transport-range"
            type="range"
            min={0}
            max={Math.max(displayDuration, 0.01)}
            step={0.01}
            value={Math.min(currentTime, Math.max(displayDuration, 0.01))}
            onChange={(event) => seekTo(Number(event.currentTarget.value))}
            aria-label="Seek"
          />
          <span className="timecode">{formatDuration(displayDuration)}</span>
          <span className="shortcut-hint">Space · ←/→ 5s{asset.kind === "video" ? " · F fit/fill" : ""}</span>
        </div>
      )}
    </section>
  );
}
