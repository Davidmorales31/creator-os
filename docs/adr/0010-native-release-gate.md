# ADR-0010 — Native build gate and single develop branch

- Status: Accepted
- Date: 2026-11-03
- Issue: #24
- Builds upon: ADR-0001 through ADR-0009

## Context

The v0.1–v0.8 feature chain was merged into `main` after aggregate CI in PR #23. Earlier staged branches complicated ancestry and allowed browser-only checks to be mistaken for native desktop acceptance. Tauri uses a system WebView; successful frontend compilation and visual screenshots do not guarantee that the release executable links and runs.

## Decision

Use `develop` as the **single active development branch** and `main` as the integrated branch, with merge-commit PRs from `develop` to `main`; do not create per-issue/stacked branches. After merging, fast-forward `develop` to `main`.

Add a native Linux Tauri 2 build check with `tauri build --no-bundle`. It depends on the official Ubuntu WebKit/AppIndicator libraries, builds the frontend and release executable, and validates that the result is an actual ELF binary. This is **compilation evidence**, not proof that the GUI opens or that all features work on an end-user machine.

Include deterministic offline preflight checks of Windows/macOS/Linux icon file formats and app metadata, but do not report this as signing/packaging compatibility.

Use [native desktop acceptance checklist](../quality/NATIVE_ACCEPTANCE.md) to track human-tested startup, media, timeline, MP4, transcription and subtitle paths on each platform. Windows/macOS remain **pending** until tested natively; no installer is automatically published.

No new runtime dependencies or remote services. Budget impact is GitHub Actions runner minutes and caching; no paid API usage.

## Rejected alternatives

- New `feat/*` branches for every issue: adds costly stacked merge drift.
- Rely solely on Chromium screenshots: does not validate Tauri link or system WebView.
- Auto-publishing unsigned installers after CI: violates release requirements.
