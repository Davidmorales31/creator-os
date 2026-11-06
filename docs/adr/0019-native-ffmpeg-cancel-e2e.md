# ADR-0019 — Native FFmpeg cancellation and job recovery regression

- Status: Accepted — real native Linux FFmpeg cancellation evidence reviewed
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

Accepted on 2026-11-06 after integrating [PR #52](https://github.com/Davidmorales31/creator-os/pull/52), closing [Issue #51](https://github.com/Davidmorales31/creator-os/issues/51) and synchronizing `main` and `develop` at `08120e50e61244eeee2efef5dc62fec04276d27b`.

The exact PR head `b7cb3f4d82edc631b82ffd0cdb281ae41fe9c534` passed [frontend/Rust/Python CI](https://github.com/Davidmorales31/creator-os/actions/runs/42234728299), [real Linux Tauri/WebKitGTK native checks](https://github.com/Davidmorales31/creator-os/actions/runs/42234728507) and [visual review](https://github.com/Davidmorales31/creator-os/actions/runs/42234728340). The inspected [cancellation artifact](https://github.com/Davidmorales31/creator-os/actions/runs/42234728507/artifacts/13510699916) contains `result.json` with `passed` and four native screenshots. It confirmed a live FFmpeg process at Rust/UI `running`, typed `export_busy`, **two actual cancellations** at about 6.5% progress, no residual FFmpeg process, no partial/final MP4, both Rust jobs reporting `cancelled` with null output and original media SHA-256 unchanged.

The CI Rust setup was hardened to skip already installed Tauri packages and bound APT time; the native smoke waits for actual painted WebKitGTK content rather than accepting a blank window. Tests still require real native UI and actual FFmpeg. This acceptance **does not** prove crash-recovery (tracked separately in [#56](https://github.com/Davidmorales31/creator-os/issues/56)), cross-platform behavior, codecs outside the synthetic fixtures, signed distributions or frame-perfect output.
