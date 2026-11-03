import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire("/tmp/creator-os-visual/package.json");
const { chromium } = require("playwright");
const outputDir = path.resolve("visual-review");
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });

await page.addInitScript(() => {
  const project = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Interstellar — Resumen",
    schemaVersion: 1,
    createdAt: "2026-11-01T09:00:00.000Z",
    updatedAt: "2026-11-03T12:00:00.000Z",
    settings: { width: 1920, height: 1080, fps: 30 }
  };
  const summaries = [
    { id: project.id, name: project.name, updatedAt: project.updatedAt },
    { id: "550e8400-e29b-41d4-a716-446655440002", name: "Resumen de Dune", updatedAt: "2026-11-02T14:00:00.000Z" },
    { id: "550e8400-e29b-41d4-a716-446655440003", name: "Ciencia ficción — Shorts", updatedAt: "2026-10-28T18:00:00.000Z" }
  ];
  const assets = [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      fileName: "interstellar-preview.webm",
      sourcePath: "/fixtures/interstellar-preview.webm",
      kind: "video",
      importedAt: "2026-11-03T12:00:00.000Z",
      fileSizeBytes: 32400000,
      durationSeconds: 120.2,
      width: 1920,
      height: 1080,
      fps: 24,
      videoCodec: "vp8",
      audioCodec: "aac",
      sampleRate: null,
      channels: null
    }
  ];
  let timeline = { schemaVersion: 1, revision: 0, tracks: [{ id: "video-1", name: "Video 1", kind: "video" }, { id: "audio-1", name: "Audio 1", kind: "audio" }], clips: [], undoStack: [], redoStack: [] };
  let exportJob = null;
  const transcript = { id: "mock-transcript", createdAt: "2026-11-03T12:00:00.000Z", schemaVersion: 1, assetId: assets[0].id, model: "base", language: "es", segments: [{ startMs: 0, endMs: 1550, text: "En un futuro, la humanidad busca un nuevo hogar." }, { startMs: 2000, endMs: 3300, text: "La historia comienza con Cooper." }] };
  let transcriptJob = null;
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args = {}) => {
      switch (command) {
        case "list_recent_projects": return summaries;
        case "open_project": return { ...project, id: args.projectId, name: summaries.find((p) => p.id === args.projectId)?.name ?? project.name };
        case "create_project": {
          const next = { ...project, name: args.name ?? "Nuevo proyecto" };
          summaries.unshift({ id: next.id, name: next.name, updatedAt: next.updatedAt });
          return next;
        }
        case "list_project_media": return assets;
        case "export_subtitles": return { transcriptId: transcript.id, format: args.format, outputPath: "/fixtures/subtitles/mock." + args.format, bytesWritten: 123 };
        case "list_transcripts": return transcriptJob?.status === "completed" ? [transcript] : [];
        case "start_transcription": {
          transcriptJob = { id: "transcription-test", assetId: assets[0].id, status: "running", resultId: null, error: null, errorCode: null };
          return transcriptJob;
        }
        case "get_transcription_status": {
          transcriptJob = { ...transcriptJob, status: "completed", resultId: transcript.id };
          return transcriptJob;
        }
        case "cancel_transcription": return { ...transcriptJob, status: "cancelled" };
        case "start_export": {
          exportJob = { id: "test-export", status: "running", progress: 0.25, outputPath: null, error: null };
          return exportJob;
        }
        case "get_export_status": {
          exportJob = { ...exportJob, status: "completed", progress: 1, outputPath: "/fixtures/exports/test-export.mp4" };
          return exportJob;
        }
        case "cancel_export": return { ...exportJob, status: "cancelled" };
        case "get_timeline": return timeline;
        case "edit_timeline": {
          const { command: action, expectedRevision } = args;
          if (expectedRevision !== timeline.revision) throw { code: "stale_timeline_revision", message: "Stale timeline" };
          if (action.action === "apply" && action.operation.type === "addClip") {
            timeline = { ...timeline, revision: timeline.revision + 1, clips: [...timeline.clips, action.operation.clip], undoStack: [ ...timeline.undoStack, { tracks: timeline.tracks, clips: timeline.clips } ] };
          }
          return timeline;
        }
        case "get_media_preview_url": return "/preview.webm";
        default: throw new Error("Unknown mock command: " + command);
      }
    }
  };
});

const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://127.0.0.1:1420/", { waitUntil: "networkidle" });
await page.getByText("Bienvenido a Creator OS").waitFor();
const logo = page.locator('img.brand-mark[src="/branding/totem-cut-app-icon.svg"]');
await logo.waitFor();
assert.equal(await logo.evaluate((node) => node.complete && node.naturalWidth > 0), true, "Totem Cut logo must load in the real UI");
await page.screenshot({ path: path.join(outputDir, "01-home-light.png"), fullPage: true });

await page.getByRole("button", { name: /Interstellar — Resumen/ }).first().click();
await page.getByText("Propiedades", { exact: true }).waitFor();
await page.locator("video").waitFor();
await page.locator("video").evaluate((video) => new Promise((resolve, reject) => {
  if (video.readyState >= 1) return resolve();
  video.addEventListener("loadedmetadata", resolve, { once: true });
  video.addEventListener("error", () => reject(new Error("Fixture video could not be decoded")), { once: true });
}));
await page.getByRole("button", { name: "+ Añadir clip" }).click();
await page.locator(".timeline-clip").waitFor();
await page.getByRole("button", { name: "Exportar MP4" }).click();
await page.getByText("Exportación terminada").waitFor();
await page.getByRole("button", { name: "Transcribir medio" }).click();
await page.getByText("En un futuro, la humanidad busca un nuevo hogar.").waitFor();
await page.getByRole("button", { name: "Exportar .srt" }).click();
await page.getByText(/Subtítulos guardados en/).waitFor();
await page.screenshot({ path: path.join(outputDir, "02-editor-light.png"), fullPage: true });

await page.getByRole("button", { name: "Activar modo oscuro" }).click();
await page.screenshot({ path: path.join(outputDir, "03-editor-dark.png"), fullPage: true });

await page.getByRole("button", { name: "Inicio", exact: true }).click();
await page.screenshot({ path: path.join(outputDir, "04-home-dark.png"), fullPage: true });

assert.deepEqual(errors, [], "No page exceptions expected");
fs.writeFileSync(path.join(outputDir, "README.txt"), [
  "Creator OS — automated UI render snapshots",
  "",
  "These screenshots are produced by the actual React/Vite source in a real Chromium browser.",
  "Project/media contents are test fixtures injected through a mocked Tauri API.",
  "They do NOT demonstrate native Tauri/FFmpeg integration or represent real user data.",
  "Viewport: 1440x900; reduced-motion; browser Chromium.",
  "Use these files for visual review against the approved mockup."
].join("\n"));

await browser.close();
console.log("Visual screenshots generated:", fs.readdirSync(outputDir));