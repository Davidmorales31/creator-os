import React, { FormEvent, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "@creator-os/ui/tokens.css";
import "./styles.css";
import {
  createProject,
  listRecentProjects,
  normalizeCommandError,
  openProject,
  type CreatorCommandError,
  type Project,
  type ProjectSummary,
} from "./projects";
import {
  formatBytes,
  formatDuration,
  importMedia,
  listProjectMedia,
  pickMediaFiles,
  type MediaAsset,
} from "./media";

function App() {
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<CreatorCommandError | null>(null);

  async function refreshRecentProjects() {
    try {
      setError(null);
      setRecentProjects(await listRecentProjects());
    } catch (cause) {
      setError(normalizeCommandError(cause));
    }
  }

  async function refreshMedia(projectId: string) {
    try {
      setError(null);
      setMediaAssets(await listProjectMedia(projectId));
    } catch (cause) {
      setError(normalizeCommandError(cause));
    }
  }

  useEffect(() => {
    void refreshRecentProjects();
  }, []);

  useEffect(() => {
    if (activeProject) {
      void refreshMedia(activeProject.id);
    } else {
      setMediaAssets([]);
    }
  }, [activeProject?.id]);

  async function handleCreateProject(event: FormEvent) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) {
      setError({ code: "invalid_project", message: "Give the project a name first." });
      return;
    }

    try {
      setBusy(true);
      setError(null);
      const project = await createProject(name);
      setActiveProject(project);
      setProjectName("");
      await refreshRecentProjects();
    } catch (cause) {
      setError(normalizeCommandError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenProject(projectId: string) {
    try {
      setBusy(true);
      setError(null);
      setActiveProject(await openProject(projectId));
    } catch (cause) {
      setError(normalizeCommandError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleImportMedia() {
    if (!activeProject) return;

    try {
      const paths = await pickMediaFiles();
      if (paths.length === 0) return;

      setImporting(true);
      setError(null);
      for (const sourcePath of paths) {
        await importMedia(activeProject.id, sourcePath);
      }
      await refreshMedia(activeProject.id);
    } catch (cause) {
      setError(normalizeCommandError(cause));
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Creator OS v0.2</span>
          <h1>Projects</h1>
        </div>
        <span className="local-badge">● Local-first</span>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <strong>{error.code}</strong>
          <span>{error.message}</span>
        </div>
      )}

      <section className="workspace-grid">
        <div className="panel create-panel">
          <span className="eyebrow">New project</span>
          <h2>Start a Creator OS project</h2>
          <p>Projects are stored locally with a versioned manifest owned by Creator OS.</p>
          <form onSubmit={handleCreateProject}>
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Interstellar — Resumen"
              disabled={busy}
              autoFocus
            />
            <button type="submit" disabled={busy}>
              {busy ? "Working…" : "Create project"}
            </button>
          </form>
        </div>

        <div className="panel active-panel">
          <span className="eyebrow">Active project</span>
          {activeProject ? (
            <>
              <h2>{activeProject.name}</h2>
              <dl className="project-meta">
                <div><dt>Schema</dt><dd>v{activeProject.schemaVersion}</dd></div>
                <div><dt>Canvas</dt><dd>{activeProject.settings.width}×{activeProject.settings.height}</dd></div>
                <div><dt>FPS</dt><dd>{activeProject.settings.fps}</dd></div>
              </dl>
              <p className="project-id">{activeProject.id}</p>
            </>
          ) : (
            <div className="empty-state">
              <h2>No project open</h2>
              <p>Create one or reopen a recent project.</p>
            </div>
          )}
        </div>
      </section>

      <section className="recent-section" aria-labelledby="recent-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Local workspace</span>
            <h2 id="recent-title">Recent projects</h2>
          </div>
          <button className="secondary-button" onClick={() => void refreshRecentProjects()} disabled={busy}>
            Refresh
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="panel empty-list">Your first project will appear here.</div>
        ) : (
          <div className="project-grid">
            {recentProjects.map((project) => (
              <button
                type="button"
                className="project-card"
                key={project.id}
                onClick={() => void handleOpenProject(project.id)}
                disabled={busy}
              >
                <span className="project-icon">CO</span>
                <span className="project-card-copy">
                  <strong>{project.name}</strong>
                  <small>Updated {new Date(project.updatedAt).toLocaleString()}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="media-section" aria-labelledby="media-title">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Project library</span>
            <h2 id="media-title">Media</h2>
          </div>
          <button
            type="button"
            onClick={() => void handleImportMedia()}
            disabled={!activeProject || importing}
          >
            {importing ? "Importing…" : "Import media"}
          </button>
        </div>

        {!activeProject ? (
          <div className="panel empty-list">Open a project before importing media.</div>
        ) : mediaAssets.length === 0 ? (
          <div className="panel empty-list">
            No media yet. Files stay in their original location; Creator OS stores references and metadata only.
          </div>
        ) : (
          <div className="media-table panel">
            <div className="media-row media-head" aria-hidden="true">
              <span>File</span><span>Type</span><span>Duration</span><span>Details</span><span>Size</span>
            </div>
            {mediaAssets.map((asset) => (
              <div className="media-row" key={asset.id}>
                <div className="media-name">
                  <span className={`media-kind media-kind-${asset.kind}`}>{asset.kind.slice(0, 1).toUpperCase()}</span>
                  <span><strong>{asset.fileName}</strong><small title={asset.sourcePath}>{asset.sourcePath}</small></span>
                </div>
                <span className="kind-label">{asset.kind}</span>
                <span>{formatDuration(asset.durationSeconds)}</span>
                <span>{asset.width && asset.height ? `${asset.width}×${asset.height}` : asset.audioCodec ?? asset.videoCodec ?? "—"}{asset.fps ? ` · ${asset.fps.toFixed(2)} fps` : ""}</span>
                <span>{formatBytes(asset.fileSizeBytes)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
