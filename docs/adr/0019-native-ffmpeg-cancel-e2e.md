# ADR-0019 — Native FFmpeg cancellation and job recovery regression

- Status: Proposed — requires CI pass and native artifact evidence before acceptance
- Date: 2026-11-06
- Issue: #51
- Depends on: ADR-0018 (real Tauri FFmpeg MP4 export), existing Rust ExportManager

## Context

Creator OS already implements asynchronous FFmpeg exports, typed `start_export`/`get_export_status`/`cancel_export`, single active-job locking, process termination and cleanup of `.partial.mp4`. v0.18 verified successful native MP4 H.264/AAC export, but it **did not prove an actively running FFmpeg worker can be cancelled and cleaned up**. Users could otherwise leave temporary files, orphan processes or a permanently blocked render queue.

The product has a reuse-first strategy. This is a missing quality gate for existing code: a new renderer or full editor rewrite is neither necessary nor approved. The owner's original upstream selection remains unrecovered (#41).

## Decision

Extend the Linux native release/WebKitGTK test runner, not product rendering infrastructure. Generate short local VP8/VP9 WebM sources and use existing native Tauri commands and real UI to construct a valid contiguous two-clip timeline.

To avoid a timing-sensitive test, configure `CREATOR_OS_FFMPEG_PATH` **only in the isolated test runtime** to point at a small runner-owned wrapper. This wrapper **executes the real FFmpeg binary** with `-re` attached to each file input, ensuring the native job remains running long enough for genuine W3C WebDriver UI actions. It does **not** fake process exit, progress or output. Production FFmpeg arguments and app behavior remain unchanged.

The test requires all of: real FFmpeg process PID under Linux `/proc` associated with the exact job output, typed Rust status `running`, native UI label `Renderizando`; a second `start_export` returning the typed `export_busy` error; the actual UI **Cancelar** button; eventual typed/UI `cancelled`, no `outputPath` or partial/final MP4 and no process left; then a new export started and cancelled to prove the active-job lock can be reused. Source SHA-256 and non-duplication invariants remain mandatory.

A stable read-only `data-export-job-id` attribute on the existing export status region associates native UI and typed job records for exact assertions. No new runtime dependency, model, cloud processing, user media or project format changes.

## Alternatives and limitations

- Sleep for a fixed time before cancellation: rejected; may cancel after output completion and falsely pass.
- Simulated command bridge/job status or stub FFmpeg process: rejected; would not demonstrate real process management.
- New export engine: unwarranted before the upstream plan/licensing audit (#41).
- CI can verify only the bounded Linux WebKitGTK path; it does not validate cross-platform cancellation, abnormal hard-kill, crash recovery, independent audio tracks, arbitrary codec behavior or signed releases.
- A test-only FFmpeg rate limiter is an orchestration tool, not a promise that all production renders exhibit the same timing.

## Acceptance evidence

Pending actual PR CI, real native screenshots and JSON result. Do not change status to Accepted until reviewed.
