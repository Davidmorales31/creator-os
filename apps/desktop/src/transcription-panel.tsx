import { useEffect, useState } from "react";
import { type MediaAsset } from "./media";
import { normalizeCommandError } from "./projects";
import {
  cancelTranscription, getTranscriptionStatus, listTranscripts, startTranscription,
  transcriptionTime, type TranscriptRecord, type TranscriptionJob,
  type TranscriptionModel, type TranscriptionLanguage,
} from "./transcription";

type Props = { projectId: string; selectedAsset: MediaAsset | null };

export function TranscriptionPanel({ projectId, selectedAsset }: Props) {
  const [model, setModel] = useState<TranscriptionModel>("base");
  const [language, setLanguage] = useState<TranscriptionLanguage>("es");
  const [allowDownload, setAllowDownload] = useState(false);
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [records, setRecords] = useState<TranscriptRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const mediaId = selectedAsset?.id ?? null;
  const canTranscribe = selectedAsset && selectedAsset.kind !== "image"
    && selectedAsset.audioCodec !== null;
  const running = job?.status === "queued" || job?.status === "running";

  useEffect(() => {
    let active = true;
    setRecords([]);
    setJob(null);
    setError(null);
    setCopied(false);
    if (!mediaId) return () => { active = false; };
    void listTranscripts(projectId, mediaId).then((items) => {
      if (active) setRecords(items);
    }).catch((cause: unknown) => {
      if (active) setError(normalizeCommandError(cause).message);
    });
    return () => { active = false; };
  }, [projectId, mediaId]);

  useEffect(() => {
    if (!job || !running) return;
    let active = true;
    const timer = window.setInterval(() => {
      void getTranscriptionStatus(job.id).then(async (current) => {
        if (!active) return;
        setJob(current);
        if (current.status === "completed" && mediaId) {
          const transcripts = await listTranscripts(projectId, mediaId);
          if (active) setRecords(transcripts);
        }
      }).catch((cause: unknown) => {
        if (active) setError(normalizeCommandError(cause).message);
      });
    }, 750);
    return () => { active = false; window.clearInterval(timer); };
  }, [job?.id, running, mediaId, projectId]);

  async function start() {
    if (!mediaId || !canTranscribe || busy || running) return;
    setError(null);
    setBusy(true);
    try {
      setJob(await startTranscription(projectId, mediaId, model, language, allowDownload));
    } catch (cause: unknown) {
      setError(normalizeCommandError(cause).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!job || busy) return;
    setBusy(true);
    try {
      setJob(await cancelTranscription(job.id));
    } catch (cause: unknown) {
      setError(normalizeCommandError(cause).message);
    } finally {
      setBusy(false);
    }
  }
  async function copyText(record: TranscriptRecord) {
    try {
      await navigator.clipboard.writeText(record.segments.map((s) => s.text).join("\n"));
      setCopied(true);
    } catch {
      setError("No fue posible copiar el texto. Revisa los permisos del portapapeles.");
    }
  }

  const transcript = records[0] ?? null;
  return (
    <section className="panel transcription-panel" aria-label="Transcripción local">
      <div className="section-heading">
        <div><span className="eyebrow">AUDIO A TEXTO · 100% LOCAL</span><h2>Transcripción</h2></div>
        <span className="transcription-counter">{records.length} guardadas</span>
      </div>
      <p className="transcription-intro">Transforma el audio del medio seleccionado en texto con marcas de tiempo. No se sube contenido a servicios externos.</p>
      <div className="transcription-settings">
        <label>Modelo
          <select value={model} onChange={(event) => setModel(event.target.value as TranscriptionModel)} disabled={busy || running}>
            <option value="tiny">Tiny · ligero</option>
            <option value="base">Base · equilibrado</option>
            <option value="small">Small · más preciso</option>
          </select>
        </label>
        <label>Idioma
          <select value={language} onChange={(event) => setLanguage(event.target.value as TranscriptionLanguage)} disabled={busy || running}>
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="auto">Detectar</option>
          </select>
        </label>
        <label className="transcription-download">
          <input type="checkbox" checked={allowDownload} onChange={(event) => setAllowDownload(event.target.checked)} disabled={busy || running} />
          Permitir descarga inicial del modelo (requiere Internet)
        </label>
      </div>
      <div className="transcription-actions">
        <button type="button" className="button button-primary" onClick={() => void start()} disabled={!canTranscribe || busy || running}>
          {running ? "Transcribiendo…" : "Transcribir medio"}
        </button>
        {running && <button type="button" className="secondary-button" onClick={() => void cancel()} disabled={busy}>Cancelar</button>}
      </div>
      {!selectedAsset && <p className="transcription-empty">Selecciona un video o audio de la biblioteca.</p>}
      {selectedAsset && !canTranscribe && <p className="transcription-empty">Este archivo no contiene una pista de audio utilizable.</p>}
      {running && <div className="transcription-running" role="status">Procesando audio localmente… La duración depende del equipo y del modelo.</div>}
      {job?.status === "failed" && <p className="export-error" role="alert">{job.errorCode}: {job.error}</p>}
      {job?.status === "cancelled" && <p className="transcription-empty" role="status">Transcripción cancelada. El material original no se modificó.</p>}
      {error && <p className="export-error" role="alert">{error}</p>}
      {transcript ? (
        <div className="transcription-results">
          <div className="transcription-meta">
            <span>{transcript.language.toUpperCase()} · {transcript.model} · {transcript.segments.length} segmentos</span>
            <button type="button" className="secondary-button" onClick={() => void copyText(transcript)}>
              {copied ? "Copiado" : "Copiar texto"}
            </button>
          </div>
          <div className="transcription-segments" role="list" aria-label="Segmentos transcritos">
            {transcript.segments.map((segment, index) => (
              <div className="transcription-segment" role="listitem" key={transcript.id + "-" + index}>
                <span className="transcription-time">{transcriptionTime(segment.startMs)}–{transcriptionTime(segment.endMs)}</span>
                <p>{segment.text}</p>
              </div>
            ))}
            {transcript.segments.length === 0 && <p className="transcription-empty">No se detectó voz en el archivo seleccionado.</p>}
          </div>
        </div>
      ) : !running && <p className="transcription-empty">Aquí aparecerán los segmentos con sus tiempos cuando termine el proceso.</p>}
      <p className="export-help">Requiere Python con <code>ai/worker[transcription]</code>. Los modelos descargados ocupan espacio local; el primero se descarga solo con autorización.</p>
    </section>
  );
}
