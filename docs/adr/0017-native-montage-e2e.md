# ADR-0017 — Native single-track montage UI and source handoff regression

- Status: Accepted (CI evidence reviewed)
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

## Acceptance record — 2026-11-04

Issue [#38](https://github.com/Davidmorales31/creator-os/issues/38) and PR [#40](https://github.com/Davidmorales31/creator-os/pull/40) were integrated into main at merge commit `89c61eb0fed216a1dcc7753bf9890690bb796b34` after green [frontend, Rust and Python checks](https://github.com/Davidmorales31/creator-os/actions/runs/41915952782) and [real Linux Tauri native checks](https://github.com/Davidmorales31/creator-os/actions/runs/41915952834). Inspected native montage evidence includes `result.json` (`passed`), two light/dark PNG captures and WebDriver logs.

The test proved real UI timeline persistence, trim/undo/redo, VP8→VP9 automatic source change with the second native WebKit decoder clock advancing (`readyState=4`), Stop cancellation, explicit gap error and unchanged source media SHA-256. A previously hidden cross-language bug was diagnosed from real native CI: Rust accepted camelCase enum variant types but expected snake_case fields (`clip_id` instead of frontend `clipId`). `#[serde(rename_all_fields = "camelCase")]` fixes the typed Rust boundary; unit tests cover move, split, trim, delete and nested Tauri commands. The existing project manifest format remains unchanged.

**Limitations remain:** no gapless/frame-perfect or universal codec guarantee; no verified GTK file chooser, multitrack compositor, Windows/macOS manual acceptance or signed installer. Reuse assessment for future functionality remains gated by [#41](https://github.com/Davidmorales31/creator-os/issues/41).
