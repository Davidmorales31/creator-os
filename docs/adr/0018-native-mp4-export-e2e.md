# ADR-0018 — Real native FFmpeg MP4 export regression on Linux

- Status: Proposed — CI and output evidence required before acceptance
- Date: 2026-11-06
- Issue: #47
- Depends on: ADR-0017 and the existing render-core/export adapter

## Context

Creator OS already owns an isolated, typed render plan (Rust `render-core`), FFmpeg command adapter and asynchronous Tauri `start_export`/`get_export_status` jobs, plus a WebKitGTK native E2E framework. Adapter unit tests exercise a synthetic FFmpeg invocation but do not prove the complete application-to-file output contract of the **release Tauri executable**.

The owner requires integrating existing open-source components rather than rewriting them. A new rendering stack would be unjustified for a **validation** request. The original upstream GitHub shortlist remains pending in Issue #41.

## Decision

Run one additional native E2E on the existing Linux release executable under Xvfb/Openbox. Generate short synthetic VP8 and VP9 WebM videos locally (no personal media). Use real Tauri bridge to import assets, actual UI to add continuous video clips, and the real **Exportar MP4** button to start the existing typed Rust/FFmpeg background render job. Verify expected typed empty-timeline error, physical output, completed typed job, and FFprobe H.264/AAC metadata at the project's width, height, FPS and expected timeline duration. Check FFmpeg's silent-track behavior for audio-less input, absence of temporary .partial.mp4 files, no duplicate sources and stable SHA-256 for original fixtures.

All sources, exported files and XDG application data are ephemeral. Store only screenshots, JSON metrics and bounded CI logs. FFmpeg/FFprobe are installed on the **runner only** and remain replaceable infrastructure. No new runtime framework, paid API, model download, cloud transfer, production license obligation or project format change is introduced.

## Limits and alternatives

- **Not tested:** deterministic cancellation of a genuinely long render, end-user GTK media picker, audio compositing with independent tracks, frame-perfect/gapless output, all codecs/OSs, installer signing, manual Windows/macOS acceptance.
- Do not claim that a green Linux CI renders every user source successfully.
- Reject mocking `start_export` or validating only the FFmpeg command string: neither verifies file persistence, UI status or the actual renderer.
- Reject a new media engine dependency just for this E2E; advanced editing/rendering requirements need the original upstream audit and an independent ADR.

## Acceptance record

Pending completion of PR CI and review of native output evidence. Preserve this section as a dated addendum when accepted.
