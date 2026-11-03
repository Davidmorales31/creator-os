import React, { useEffect, useState, type FormEvent } from "react";
import ReactDOM from "react-dom/client";
import { open } from "@tauri-apps/plugin-dialog";
import "@creator-os/ui/tokens.css";
import "./styles.css";
import { createProject, listRecentProjects, normalizeCommandError, openProject, type CreatorCommandError, type Project, type ProjectSummary } from "./projects";
import { formatDuration, formatFileSize, importMedia, listProjectMedia, type MediaAsset } from "./media";
import { MediaPlayer } from "./player";

function App() {
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]); const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState(""); const [busy, setBusy] = useState(false); const [mediaBusy, setMediaBusy] = useState(false);
  const [error, setError] = useState<CreatorCommandError | null>(null); const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]); const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  async function refreshRecentProjects() { try { setError(null); setRecentProjects(await listRecentProjects()); } catch (cause) { setError(normalizeCommandError(cause)); } }
  async function refreshMedia(projectId: string) { try { setError(null); const assets = await listProjectMedia(projectId); setMediaAssets(assets); setSelectedMedia((current) => current ? assets.find((asset) => asset.id === current.id) ?? assets.find((asset) => asset.kind === "video") ?? assets[0] ?? null : assets.find((asset) => asset.kind === "video") ?? assets[0] ?? null); } catch (cause) { setError(normalizeCommandError(cause)); } }
  useEffect(() => { void refreshRecentProjects(); }, []);
  async function activateProject(project: Project) { setActiveProject(project); setSelectedMedia(null); setMediaAssets([]); await refreshMedia(project.id); }
  async function handleCreateProject(event: FormEvent) { event.preventDefault(); const name = projectName.trim(); if (!name) { setError({ code: "invalid_project", message: "Give the project a name first." }); return; } try { setBusy(true); setError(null); const project = await createProject(name); setProjectName(""); await activateProject(project); await refreshRecentProjects(); } catch (cause) { setError(normalizeCommandError(cause)); } finally { setBusy(false); } }
  async function handleOpenProject(projectId: string) { try { setBusy(true); setError(null); await activateProject(await openProject(projectId)); } catch (cause) { setError(normalizeCommandError(cause)); } finally { setBusy(false); } }
  async function handleImportMedia() {
    if (!activeProject) return;
    try {
      const selected = await open({ multiple: true, directory: false, filters: [{ name: "Media", extensions: ["mp4","mov","mkv","webm","m4v","avi","mp3","wav","m4a","aac","flac","ogg","jpg","jpeg","png","webp","bmp","tif","tiff","avif","heic"] }] });
      if (!selected) return; const paths = Array.isArray(selected) ? selected : [selected]; if (paths.length === 0) return;
      setMediaBusy(true); setError(null); let lastImported: MediaAsset | null = null;
      for (const sourcePath of paths) lastImported = await importMedia(activeProject.id, sourcePath);
      await refreshMedia(activeProject.id); if (lastImported) setSelectedMedia(lastImported);
    } catch (cause) { setError(normalizeCommandError(cause)); } finally { setMediaBusy(false); }
  }
  return <main className="app-shell">
    <header className="topbar"><div><span className="eyebrow">Creator OS v0.3</span><h1>Projects</h1></div><span className="local-badge">● Local-first</span></header>
    {error && <div className="error-banner" role="alert"><strong>{error.code}</strong><span>{error.message}</span></div>}
    <section className="workspace-grid">
      <div className="panel create-panel"><span className="eyebrow">New project</span><h2>Start a Creator OS project</h2><p>Projects are stored locally with a versioned manifest owned by Creator OS.</p><form onSubmit={handleCreateProject}><label htmlFor="project-name">Project name</label><input id="project-name" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Interstellar — Resumen" disabled={busy} autoFocus/><button type="submit" disabled={busy}>{busy ? "Working…" : "Create project"}</button></form></div>
      <div className="panel active-panel"><span className="eyebrow">Active project</span>{activeProject ? <><h2>{activeProject.name}</h2><dl className="project-meta"><div><dt>Schema</dt><dd>v{activeProject.schemaVersion}</dd></div><div><dt>Canvas</dt><dd>{activeProject.settings.width}×{activeProject.settings.height}</dd></div><div><dt>FPS</dt><dd>{activeProject.settings.fps}</dd></div></dl><p className="project-id">{activeProject.id}</p></> : <div className="empty-state"><h2>No project open</h2><p>Create one or reopen a recent project.</p></div>}</div>
    </section>
    {activeProject && <section className="creator-workspace" aria-label="Creator workspace">
      <MediaPlayer projectId={activeProject.id} asset={selectedMedia}/>
      <section className="panel media-panel" aria-labelledby="media-title"><div className="section-heading"><div><span className="eyebrow">Project assets</span><h2 id="media-title">Media</h2></div><button type="button" className="secondary-button" onClick={() => void handleImportMedia()} disabled={mediaBusy}>{mediaBusy ? "Importing…" : "Import media"}</button></div>
      {mediaAssets.length === 0 ? <div className="media-empty"><strong>No media yet</strong><span>Import video, audio, or images. Source files stay where they are.</span></div> : <div className="media-list">{mediaAssets.map((asset) => { const resolution = asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"; const codec = asset.videoCodec ?? asset.audioCodec ?? "—"; const selected = selectedMedia?.id === asset.id; return <button type="button" className={`media-row${selected ? " media-row-selected" : ""}`} key={asset.id} onClick={() => setSelectedMedia(asset)}><span className={`media-kind media-kind-${asset.kind}`}>{asset.kind.slice(0, 1).toUpperCase()}</span><span className="media-copy"><strong title={asset.fileName}>{asset.fileName}</strong><small>{asset.kind} · {formatDuration(asset.durationSeconds)} · {formatFileSize(asset.fileSizeBytes)}</small></span><span className="media-tech"><small>{resolution}</small><small>{asset.fps ? `${asset.fps.toFixed(2)} fps` : codec}</small></span></button>; })}</div>}
      </section>
    </section>}
    <section className="recent-section" aria-labelledby="recent-title"><div className="section-heading"><div><span className="eyebrow">Local workspace</span><h2 id="recent-title">Recent projects</h2></div><button className="secondary-button" onClick={() => void refreshRecentProjects()} disabled={busy}>Refresh</button></div>{recentProjects.length === 0 ? <div className="panel empty-list">Your first project will appear here.</div> : <div className="project-grid">{recentProjects.map((project) => <button type="button" className="project-card" key={project.id} onClick={() => void handleOpenProject(project.id)} disabled={busy}><span className="project-icon">CO</span><span className="project-card-copy"><strong>{project.name}</strong><small>Updated {new Date(project.updatedAt).toLocaleString()}</small></span><span aria-hidden="true">→</span></button>)}</div>}</section>
  </main>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
