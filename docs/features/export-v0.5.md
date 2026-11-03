# Export MP4 (v0.5)

Issue #15: first **local**, non-destructive export slice.

## What works

In Creator OS, open a project and import media. Add video clips to the timeline, with no gaps and only one populated video track. Use **Exportar MP4** below the timeline. Observe progress; cancel if necessary. When finished, Creator OS displays the final local file path inside `projects/<uuid>/exports/` under the application's data directory.

The export uses the timeline's source-in frames and durations, re-encodes video to H.264 with matching project size/frame rate, and outputs stereo AAC audio. Source video sound is included; a video without sound becomes silence during that segment. All source files remain untouched.

**Not implemented:** exporting populated audio-only tracks, timeline gaps, still images, mixed video tracks, overlaid narration, subtitles or transitions. These return explicit errors rather than yielding a misleading finished movie.

## Setup

Install a legally obtained FFmpeg build with H.264 `libx264` and AAC encoders; check:

```sh
ffmpeg -version
ffmpeg -encoders
```

By default Creator OS uses `ffmpeg` from PATH. Alternatively set `CREATOR_OS_FFMPEG_PATH` to the trusted executable's path. Never pass arbitrary FFmpeg command strings from UI.

## Cost / hardware constraints

- Online infrastructure and provider charges: **none**. Rendering is local.
- Heavy movies may be CPU- and disk-intensive; the first version limits simultaneous renders to one.
- Output is a newly encoded MP4; source media are referenced in place and never duplicated.
- The export temporarily creates a `.partial.mp4` and deletes it on cancellation or FFmpeg failure.
- `libx264` may not be present in every FFmpeg build, and build/license terms vary. FFmpeg is not bundled with Creator OS in v0.5.
- The progress indicator reflects FFmpeg-reported processing time; it is not an exact remaining-time forecast.

## Manual acceptance

Run Creator OS native in Windows, macOS or Linux with FFmpeg installed. Create a project, import two small videos (one with sound, one silent), add contiguous clips, trim and split. Export and play the resulting MP4; check approximate duration and that both video sections appear in order. Test cancel and verify no `.partial.mp4` remains. Test source missing and unsupported tracks to confirm descriptive errors. Reopen the project and confirm originals and timeline state are unchanged.

## Architecture

`crates/render-core`: pure, deterministic validation and plan.

`apps/desktop/src-tauri/src/export_adapter.rs`: FFmpeg-specific filtergraph and argument list.

`apps/desktop/src-tauri/src/export_jobs.rs`: local background execution, progress/cancel, output file lifecycle.

`apps/desktop/src/export-panel.tsx`: presentation only.

See `docs/adr/0006-local-export.md` and `CONSTITUTION.md`.
