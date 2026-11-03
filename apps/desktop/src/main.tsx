import React, { useEffect, useState, type FormEvent } from "react";
import ReactDOM from "react-dom/client";
import { open } from "@tauri-apps/plugin-dialog";
import "@creator-os/ui/tokens.css";
import "./styles.css";
import { createProject, listRecentProjects, normalizeCommandError, openProject, type CreatorCommandError, type Project, type ProjectSummary } from "./projects";
import { formatDuration, formatFileSize, importMedia, listProjectMedia, type MediaAsset } from "./media";
import { MediaPlayer } from "./player";
import { TimelinePanel } from "./timeline-panel";
import { ExportPanel } from "./export-panel";
import { TranscriptionPanel } from "./transcription-panel";

type View = "projects" | "workspace";
type Theme = "light" | "dark";

function App() {
  const [view, setView] = useState<View>("projects");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState<CreatorCommandError | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  async function refreshRecentProjects() {
    try { setError(null); setRecentProjects(await listRecentProjects()); }
    catch (cause) { setError(normalizeCommandError(cause)); }
  }
  async function refreshMedia(projectId: string) {
    try {
      setError(null);
      const assets = await listProjectMedia(projectId);
      setMediaAssets(assets);
      setSelectedMedia((current) => {
        if (current) {
          const stillPresent = assets.find((asset) => asset.id === current.id);
          if (stillPresent) return stillPresent;
        }
        return assets.find((asset) => asset.kind === "video") ?? assets[0] ?? null;
      });
    } catch (cause) { setError(normalizeCommandError(cause)); }
  }
  useEffect(() => { void refreshRecentProjects(); }, []);

  async function activateProject(project: Project) {
    setActiveProject(project);
    setSelectedMedia(null);
    setMediaAssets([]);
    setView("workspace");
    await refreshMedia(project.id);
  }

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) {
      setError({ code: "invalid_project", message: "Escribe un nombre para el proyecto." });
      return;
    }
    try {
      setBusy(true); setError(null);
      const project = await createProject(name);
      setProjectName("");
      await activateProject(project);
      await refreshRecentProjects();
    } catch (cause) { setError(normalizeCommandError(cause)); }
    finally { setBusy(false); }
  }

  async function handleOpenProject(projectId: string) {
    try {
      setBusy(true); setError(null);
      await activateProject(await openProject(projectId));
    } catch (cause) { setError(normalizeCommandError(cause)); }
    finally { setBusy(false); }
  }

  async function handleImportMedia() {
    if (!activeProject) return;
    try {
      const selected = await open({
        multiple: true, directory: false,
        filters: [{ name: "Media", extensions: ["mp4","mov","mkv","webm","m4v","avi","mp3","wav","m4a","aac","flac","ogg","jpg","jpeg","png","webp","bmp","tif","tiff","avif","heic"] }]
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length === 0) return;
      setMediaBusy(true); setError(null);
      let lastImported: MediaAsset | null = null;
      for (const sourcePath of paths) lastImported = await importMedia(activeProject.id, sourcePath);
      await refreshMedia(activeProject.id);
      if (lastImported) setSelectedMedia(lastImported);
    } catch (cause) { setError(normalizeCommandError(cause)); }
    finally { setMediaBusy(false); }
  }

  return (
    <div className="desktop-shell">
      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="brand-row">
          <img className="brand-mark" src="/branding/totem-cut-app-icon.svg" alt="" aria-hidden="true" width={38} height={38} />
          <span className="brand-copy"><strong>Creator OS</strong><small>Creator workspace</small></span>
        </div>
        <div className="nav-group">
          <span className="nav-caption">NAVEGACIÓN</span>
          <button type="button" className={`nav-item ${view === "projects" ? "nav-item-active" : ""}`} aria-current={view === "projects" ? "page" : undefined} onClick={() => setView("projects")}><span className="nav-symbol" aria-hidden="true">⌂</span> Inicio</button>
          <button type="button" className="nav-item" onClick={() => setView("projects")}>
            <span className="nav-symbol" aria-hidden="true">▦</span> Proyectos
          </button>
          <button type="button" className={`nav-item ${view === "workspace" ? "nav-item-active" : ""}`} aria-current={view === "workspace" ? "page" : undefined} onClick={() => setView("workspace")} disabled={!activeProject}>
            <span className="nav-symbol" aria-hidden="true">▤</span> Editor
          </button>
          <span className="nav-caption nav-caption-secondary">HERRAMIENTAS</span>
          <span className="nav-item nav-item-soon"><span className="nav-symbol" aria-hidden="true">◈</span> Script Studio <span className="nav-soon">Pronto</span></span>
          <span className="nav-item nav-item-soon"><span className="nav-symbol" aria-hidden="true">♫</span> Voice Studio <span className="nav-soon">Pronto</span></span>
          <span className="nav-item nav-item-soon"><span className="nav-symbol" aria-hidden="true">▣</span> Biblioteca <span className="nav-soon">Pronto</span></span>
          <span className="nav-item nav-item-soon"><span className="nav-symbol" aria-hidden="true">◧</span> Shorts <span className="nav-soon">Pronto</span></span>
          <span className="nav-item nav-item-soon"><span className="nav-symbol" aria-hidden="true">▧</span> Miniaturas <span className="nav-soon">Pronto</span></span>
          <span className="nav-item nav-item-soon"><span className="nav-symbol" aria-hidden="true">⇧</span> Publicar <span className="nav-soon">Pronto</span></span>
          <span className="nav-item nav-item-soon"><span className="nav-symbol" aria-hidden="true">▥</span> Analíticas <span className="nav-soon">Pronto</span></span>
        </div>
        <div className="sidebar-footer">
          <div className="privacy-line"><span className="status-dot" aria-hidden="true" /> Local-first · Tus archivos</div>
          <button type="button" className="theme-button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Activar modo oscuro" : "Activar modo claro"}>
            <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span> {theme === "light" ? "Modo oscuro" : "Modo claro"}
          </button>
          <span className="version-label">CREATOR OS · v0.6</span>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-toolbar">
          <div className="toolbar-breadcrumb"><span>Creator OS</span><span className="breadcrumb-divider">/</span><strong>{view === "workspace" ? activeProject?.name ?? "Estudio" : "Proyectos"}</strong></div>
          <label className="toolbar-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar proyectos" placeholder="Buscar en tus proyectos..." value={search} onChange={(event) => {setSearch(event.target.value); if (view !== "projects") setView("projects");}} /></label>
          <div className="toolbar-actions">
            <span className="toolbar-platform">Desktop · Local</span>
            {view === "workspace" && <button type="button" className="button button-primary" onClick={() => void handleImportMedia()} disabled={!activeProject || mediaBusy}>{mediaBusy ? "Importando…" : "+ Importar medios"}</button>}
          </div>
        </header>

        {error && <div className="error-banner" role="alert"><strong>{error.code}</strong><span>{error.message}</span><button type="button" className="error-dismiss" onClick={() => setError(null)} aria-label="Cerrar error">×</button></div>}

        {view === "projects" ? (
          <div className="content-scroll">
            <div className="page-intro">
              <span className="eyebrow">TU ESPACIO CREATIVO</span>
              <h1>Bienvenido a Creator OS<span className="title-point">.</span></h1>
              <p>Tu estudio completo para crear, editar y publicar contenido.</p>
            </div>
            <div className="quick-actions" aria-label="Accesos rápidos">
              <button type="button" className="quick-action-card quick-action-primary" onClick={() => document.getElementById("project-name")?.focus()}><span className="quick-icon" aria-hidden="true">＋</span><strong>Nuevo proyecto</strong><small>Video, Short o Serie</small></button>
              <div className="quick-action-card quick-action-future"><span className="quick-icon" aria-hidden="true">✎</span><strong>Generar Guion</strong><small>Próximamente</small></div>
              <div className="quick-action-card quick-action-future"><span className="quick-icon" aria-hidden="true">◉</span><strong>Clonar mi voz</strong><small>Próximamente</small></div>
              <div className="quick-action-card quick-action-future"><span className="quick-icon" aria-hidden="true">▯</span><strong>Crear Short</strong><small>Próximamente</small></div>
              <div className="quick-action-card quick-action-future"><span className="quick-icon" aria-hidden="true">♧</span><strong>Publicar</strong><small>Próximamente</small></div>
            </div>
            <div className="home-grid"><div className="projects-layout">
              <section className="panel new-project-panel" aria-labelledby="new-project-title">
                <span className="feature-icon" aria-hidden="true">＋</span>
                <span className="eyebrow">EMPEZAR ALGO NUEVO</span>
                <h2 id="new-project-title">Crea tu próxima historia</h2>
                <p>Comienza con un proyecto local. Los videos originales se quedan donde están.</p>
                <form onSubmit={handleCreateProject} className="new-project-form">
                  <label htmlFor="project-name">Nombre del proyecto</label>
                  <input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Ej. Resumen de Interstellar" disabled={busy}/>
                  <button type="submit" className="button button-primary button-wide" disabled={busy}>{busy ? "Creando…" : "＋ Crear proyecto"}</button>
                </form>
              </section>
              <section className="panel recent-panel" aria-labelledby="recent-title">
                <div className="section-heading"><div><span className="eyebrow">CONTINÚA CREANDO</span><h2 id="recent-title">Recientes</h2></div><button type="button" className="button button-ghost" onClick={() => void refreshRecentProjects()} disabled={busy}>Actualizar</button></div>
                {recentProjects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase())).length === 0 ? (
                  <div className="empty-state"><span className="empty-glyph" aria-hidden="true">▦</span><strong>Aún no hay proyectos</strong><p>Crea tu primer proyecto para comenzar.</p></div>
                ) : (
                  <div className="recent-list">{recentProjects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase())).map((project) => <button type="button" key={project.id} className="recent-item" onClick={() => void handleOpenProject(project.id)} disabled={busy}><span className="project-icon" aria-hidden="true">◧</span><span className="recent-copy"><strong>{project.name}</strong><small>{new Date(project.updatedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</small></span><span className="recent-arrow" aria-hidden="true">›</span></button>)}</div>
                )}
              </section>
            </div><aside className="home-activity"><section className="panel activity-card"><span className="eyebrow">ACTIVIDAD RECIENTE</span><h2>Tu actividad</h2><div className="activity-empty">Aún no hay tareas procesadas. Aquí aparecerán transcripciones, renders y exportaciones.</div></section><section className="panel status-card"><span className="eyebrow">ESTADO DEL SISTEMA</span><div className="status-entry"><span className="status-dot"/> Editor <span>Disponible</span></div><div className="status-entry"><span className="status-dot"/> Proyectos <span>Local</span></div><div className="status-entry"><span className="status-dot"/> Medios <span>Listo</span></div><div className="status-entry"><span className="status-dot status-inactive"/> IA local <span>Próximamente</span></div></section></aside></div>
          </div>
        ) : activeProject ? (
          <div className="content-scroll workspace-page">
            <div className="workspace-header"><div><span className="eyebrow">ESTUDIO / PROYECTO ACTIVO</span><h1>{activeProject.name}<span className="title-point">.</span></h1><p>Previsualiza tu material y prepara la siguiente edición.</p></div><span className="project-format">{activeProject.settings.width} × {activeProject.settings.height} · {activeProject.settings.fps} fps</span></div>
            <div className="editor-actions" aria-label="Herramientas futuras"><span className="editor-chip">Eliminar silencios · próximamente</span><span className="editor-chip">Auto subtítulos · próximamente</span><span className="editor-chip">Buscar B-roll · próximamente</span><span className="editor-chip">Reencuadrar 9:16 · próximamente</span></div>
            <div className="creator-workspace">
              <section className="panel media-panel" aria-labelledby="media-title">
                <div className="section-heading"><div><span className="eyebrow">BIBLIOTECA LOCAL</span><h2 id="media-title">Tus medios <span className="media-count">{mediaAssets.length}</span></h2></div></div>
                {mediaAssets.length === 0 ? (
                  <div className="media-empty"><span className="empty-glyph" aria-hidden="true">▣</span><strong>Importa tu primer video</strong><p>Sin duplicar archivos ni consumir espacio extra.</p><button type="button" className="button button-primary" onClick={() => void handleImportMedia()} disabled={mediaBusy}>{mediaBusy ? "Importando…" : "+ Importar medios"}</button></div>
                ) : (
                  <div className="media-list" role="group" aria-label="Archivos importados">
                    {mediaAssets.map((asset) => {
                      const selected = selectedMedia?.id === asset.id;
                      return <button key={asset.id} type="button" className={`media-row ${selected ? "media-row-selected" : ""}`} aria-pressed={selected} onClick={() => setSelectedMedia(asset)}>
                        <span className={`media-kind media-kind-${asset.kind}`} aria-hidden="true">{asset.kind === "video" ? "▶" : asset.kind === "audio" ? "♫" : "▧"}</span>
                        <span className="media-copy"><strong title={asset.fileName}>{asset.fileName}</strong><small>{formatDuration(asset.durationSeconds)} · {formatFileSize(asset.fileSizeBytes)}</small></span>
                        <span className="media-tech">{asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.kind}</span>
                      </button>;
                    })}
                  </div>
                )}
                <div className="media-panel-footer">Los archivos permanecen en su ubicación original.</div>
              </section>
              <MediaPlayer projectId={activeProject.id} asset={selectedMedia}/>
              <aside className="panel inspector-panel"><div className="section-heading"><div><span className="eyebrow">INSPECTOR</span><h2>Propiedades</h2></div></div>{selectedMedia ? <dl className="inspector-fields"><div><dt>Archivo</dt><dd title={selectedMedia.fileName}>{selectedMedia.fileName}</dd></div><div><dt>Tipo</dt><dd>{selectedMedia.kind}</dd></div><div><dt>Duración</dt><dd>{formatDuration(selectedMedia.durationSeconds)}</dd></div><div><dt>Resolución</dt><dd>{selectedMedia.width && selectedMedia.height ? `${selectedMedia.width} × ${selectedMedia.height}` : "—"}</dd></div><div><dt>FPS</dt><dd>{selectedMedia.fps?.toFixed(2) ?? "—"}</dd></div></dl> : <p>Selecciona un archivo para ver sus propiedades.</p>}</aside>
            </div>
            <TimelinePanel projectId={activeProject.id} fps={activeProject.settings.fps} mediaAssets={mediaAssets} selectedAsset={selectedMedia} onError={(message) => setError({ code: "timeline_error", message })} />
            <ExportPanel projectId={activeProject.id} />
            <TranscriptionPanel projectId={activeProject.id} selectedAsset={selectedMedia} />
            <div className="workspace-hint"><span aria-hidden="true">⌘</span> Selecciona un video y usa Espacio para reproducir; ← → para avanzar o retroceder 5 s.</div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
