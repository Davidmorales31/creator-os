# ADR-0018 — Real native FFmpeg MP4 export regression on Linux

- Status: Accepted — Linux native export and FFprobe evidence reviewed
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

**Accepted 2026-11-06.** [Issue #47](https://github.com/Davidmorales31/creator-os/issues/47) and [PR #48](https://github.com/Davidmorales31/creator-os/pull/48) were merged into `main` at `54d0335abe21bc40cd7dab218666bcf362752071` after successful [frontend/Rust/Python CI](https://github.com/Davidmorales31/creator-os/actions/runs/42223830589) and [real Tauri Linux WebKitGTK E2E](https://github.com/Davidmorales31/creator-os/actions/runs/42223830662). The inspected [native export artifact](https://github.com/Davidmorales31/creator-os/actions/runs/42223830662/artifacts/13505156996) contains `result.json` (`passed`) and native before/after screenshots and logs.

The real UI produced exactly one MP4, independently measured by FFprobe as **H.264/yuv420p, AAC, 1920×1080, 30 FPS, 4.0 seconds, 50,704 bytes** from local short VP8 and VP9 fixtures. A typed `empty_timeline` error was confirmed before the timeline was created. The actual Rust job reported `completed`, `progress=1.0`, and the same final output path as the UI and file system. No `.partial.mp4` remained; source SHA-256 checksums were unchanged and no sources were duplicated. The E2E runs without media uploads, new runtime dependencies or a new rendering backend.

**Scope remains restricted** to a continuous single video track and this Linux CI pathway. Cancellation, independent audio tracks, frame-perfect/gapless rendering, file-dialog UI acceptance, Windows/macOS and installer signing were **not** tested. The missing historical owner-approved upstream list remains tracked in [#41](https://github.com/Davidmorales31/creator-os/issues/41).
