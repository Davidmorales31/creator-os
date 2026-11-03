# ADR-0006 — Local FFmpeg MP4 export pipeline (first supported subset)

- **Status:** Accepted
- **Date:** 2026-11-03
- **Supersedes:** None
- **Issue:** #15

## Context

Creator OS has an independently versioned project timeline, referenced original video assets, and a local-first commitment. The first render must produce a genuinely playable file while keeping the architecture replaceable, avoiding cloud charges, and not claiming a full NLE exporter before the editor supports mixed tracks and compositor effects.

## Decision

1. `crates/render-core` owns a deterministic `RenderPlan::build(timeline, media, project settings)`. It depends only on Creator OS media/timeline domains. It does not know Tauri, FFmpeg, or the filesystem.
2. Version 0.5 explicitly supports **one populated video track, with all clips contiguous starting at frame zero, backed by video assets**. The source audio stream is used when present; silence is inserted for silent clips. Other arrangements fail with typed, user-visible errors instead of being dropped or invisibly flattened.
3. The FFmpeg command adapter lives in `apps/desktop/src-tauri/src/export_adapter.rs`. It builds an **argument vector**, not shell command text. Each segment is trimmed and normalized to the project frame rate and dimensions, with stereo 48kHz audio; a concat filter combines them into an MP4 (H.264/AAC) on CPU.
4. The desktop app snapshots the project revision, validates the referenced catalog and file presence, then starts one background render job at a time. A command exposes job status/progress and cancellation. FFmpeg progress is parsed from `out_time_us`.
5. Render writes a unique `.partial.mp4` file in the project's `exports/` folder, checks it is nonempty and atomically renames it to a unique final path on success. On failure/cancel the temporary file is removed. Source media are read only.
6. No FFmpeg binary is bundled at this stage. The user must supply `ffmpeg` on PATH (or `CREATOR_OS_FFMPEG_PATH`). The precise FFmpeg build and codecs have third-party licensing ramifications; shipping a binary requires a later distribution/licensing ADR.

## Current unsupported capabilities

Separate music/narration tracks, image slides, gaps between clips, overlapping video layers, transitions, filter/effects stack, subtitles, hardware encoding and exact timebase conversion at fractional FPS are not silently emulated. They require future project/editor milestones and tests.

## Budget and system-resource requirements

| Resource | v0.5 policy |
| --- | --- |
| Hosted compute | **$0**; processing takes place on the local machine |
| API/model usage | **$0**; no AI requests |
| CPU | FFmpeg `libx264`, `veryfast`, CRF 23, limited to 2 encoder threads; device-dependent render speed |
| RAM | Streaming decode/filter/encode; no whole-file buffering in React |
| Storage | No source duplication. A temporary MP4 plus final MP4 occupy up to roughly two output sizes briefly around finalization; failures clean temp |
| Concurrency | One active render job per desktop process |
| Duration | First-pass cap of 24 hours of timeline content |
| Network | None required for render |
| Licenses | FFmpeg's actual build configuration must be audited before redistribution |

Do **not** claim zero disk impact: users must have sufficient space for their exported MP4, and even local exports consume CPU and energy.

## Testing

Unit tests cover export-plan ordering, source bounds, track restrictions, frame accuracy, FFmpeg argument isolation, and progress/cancel state. CI installs FFmpeg and uses a short real encode/decode smoke test. Browser screenshot tests use explicit mocked Tauri data and cannot replace native desktop testing.

## Follow-ups

- Add coherent audio mixing, gaps, clips derived from stills, GPU backends and stream overlays in a new ADR.
- Add Windows/macOS/Linux native encode/cancel tests and app-shutdown child-process cleanup.
- Add crash-recovery bookkeeping for interrupted exports if export durability becomes a requirement.
