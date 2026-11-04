# ADR-0017 — Native single-track montage UI and source handoff regression

- Status: Proposed (CI validation required before acceptance)
- Date: 2026-11-04
- Issue: #38
- Depends on: ADR-0012, ADR-0013, ADR-0016

## Context

Creator OS already has a typed Rust timeline model, a pure TypeScript one-track montage planner, native FFprobe imports, and tested VP8/VP9 WebKitGTK decoding. Previous playback handoff tests primarily used a Chromium bridge mock; they could not prove the full **real release Tauri + WebKit + Rust persistence + two independent media sources** path.

## Decision

Reuse the existing v0.15 native Linux runner, Tauri release ELF, FFmpeg fixtures, WebKitGTK/tauri-driver and Python WebDriver helpers. Run a separate stdlib Python E2E for Issue #38, **without a new video editor, playback engine, runtime dependency, fork or downloaded model**. It creates/imports real test assets, uses existing timeline UI controls to add contiguous clips, trims the second clip and verifies undo/redo against `get_timeline` plus `project.json`, then clicks the native montage control and measures WebKit `video.currentTime` before and after the automatic VP8→VP9 switch. Verify that Stop leaves the native video paused and that a deliberately introduced gap returns a visible error without activating montage. Verify original video SHA-256 and synthetic-only artifact capture.

The E2E is designed as a **reuse assessment for an already implemented feature**. There is no justification for choosing a new third-party repository simply to add regression coverage. Future editing modules must undergo the explicit upstream-repository evaluation mandated by `AGENTS.md` and the master plan; the owner's historical approved list is still pending.

## Boundaries and limitations

Green CI only confirms this exercised Linux WebKitGTK two-source montage flow; it **does not** guarantee gapless or frame-perfect transitions, compositing/multitrack support, general codec compatibility, GTK file chooser acceptance, Windows/macOS user flows or signed installer readiness. Do not mark manual acceptance as complete. Synthetic fixtures, XDG storage and logs are isolated; no paid API, cloud upload or implicit model download is introduced.

## Alternatives

- Rewrite montage infrastructure to use another media engine: not warranted without a separate upstream assessment and performance/compatibility evidence.
- Only unit tests/Chromium mocks: cannot catch native FFprobe/WebKit handoff bugs.
- GUI pixel-position automation: fragile compared with accessible DOM selectors and typed commands.
