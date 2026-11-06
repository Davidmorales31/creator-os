import { useEffect, useState } from "react";
import { normalizeCommandError } from "./projects";
import { cancelExport, getExportStatus, startExport, type ExportJob } from "./export";

type Props = { projectId: string };
const labels: Record<ExportJob["status"], string> = {
  queued: "En cola",
  running: "Renderizando",
  completed: "Exportación terminada",
  failed: "Exportación fallida",
  cancelled: "Exportación cancelada",
};

export function ExportPanel({ projectId }: Props) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inProgress = job?.status === "queued" || job?.status === "running";
  const progress = Math.round((job?.progress ?? 0) * 100);

  useEffect(() => {
    setJob(null);
    setProblem(null);
  }, [projectId]);

  useEffect(() => {
    if (!job || !inProgress) return;
    let alive = true;
    const timer = window.setInterval(() => {
      void getExportStatus(job.id).then((latest) => {
        if (alive) setJob(latest);
      }).catch((error: unknown) => {
        if (!alive) return;
        setProblem(normalizeCommandError(error).message);
        // Query failure leaves the job running; retry via the next poll instead of inventing completion.
      });
    }, 650);
    return () => { alive = false; window.clearInterval(timer); };
  }, [job?.id, inProgress]);

  async function start() {
    setBusy(true);
    setProblem(null);
    try {
      const next = await startExport(projectId);
      setJob(next);
    } catch (cause: unknown) {
      const error = normalizeCommandError(cause);
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!job) return;
    setBusy(true);
    setProblem(null);
    try {
      setJob(await cancelExport(job.id));
    } catch (cause: unknown) {
      setProblem(normalizeCommandError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel export-panel" aria-label="Exportar proyecto">
      <div className="export-panel-heading">
        <div>
          <span className="eyebrow">EXPORTACIÓN LOCAL · SIN SUBIR ARCHIVOS</span>
          <h2>Exportar video <span className="export-format">MP4 · H.264 / AAC</span></h2>
          <p>Versión inicial: una pista de video continua. El audio de cada video se conserva; el original nunca se modifica.</p>
        </div>
        <div className="export-panel-actions">
          <button type="button" className="button button-primary" onClick={() => void start()} disabled={busy || inProgress}>
            {inProgress ? "Exportando…" : job?.status === "completed" ? "Nueva exportación" : "Exportar MP4"}
          </button>
          {inProgress && <button type="button" className="secondary-button export-cancel" onClick={() => void cancel()} disabled={busy}>Cancelar</button>}
        </div>
      </div>
      {job && (
        <div className="export-progress" role="status" aria-live="polite" data-export-job-id={job.id}>
          <div className="export-progress-caption"><strong>{labels[job.status]}</strong><span>{progress}%</span></div>
          <progress max={100} value={progress} aria-label="Progreso del render" />
          {job.status === "completed" && job.outputPath && <p className="export-output-path">Guardado en: <strong>{job.outputPath}</strong></p>}
          {job.status === "failed" && job.error && <p className="export-error">{job.error}</p>}
        </div>
      )}
      {problem && <p className="export-error" role="alert">{problem}</p>}
      <p className="export-help">Requiere FFmpeg instalado. Los resultados quedan en la carpeta local <code>exports/</code> del proyecto. Solo se ejecuta un render a la vez.</p>
    </section>
  );
}
