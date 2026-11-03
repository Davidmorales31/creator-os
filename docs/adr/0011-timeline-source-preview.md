# ADR-0011 — Timeline-to-source preview without montage playback

- Status: Accepted
- Date: 2026-11-03
- Issue: #26
- Dependencies: ADR-0001 through ADR-0010

## Context

Creator OS has a frame-indexed edit decision list and a source media player, but the timeline playhead was decorative. Correctly seeking a trimmed source clip is prerequisite to montage playback, captions attached to a clip, and native keyboard editing.

## Decision

The **pure TypeScript** mapping module `apps/desktop/src/timeline-preview.ts` converts a project-timeline absolute frame into a selected video's source time:

`sourceFrame = clip.sourceInFrame + (timelineFrame - clip.startFrame)` for a frame within the half-open clip interval `[startFrame, startFrame + durationFrames)`.

Frames, not float seconds, drive clip boundaries. FPS is the project's integer FPS. The first configured video track containing a clip at the requested frame has precedence; overlapping video layers are **not** composited and separate audio tracks are **not** mixed. Gaps without video return no preview mapping.

`TimelinePanel` emits a typed `TimelinePreviewTarget` for clip or time-ruler actions. The desktop controller selects a **registered media catalog asset** by ID, then sends a versioned request to the existing `MediaPlayer`. The player waits for real HTML video metadata and seeks to the source time; it never receives an arbitrary path or calls FFmpeg to seek. A new request pauses the source preview instead of claiming continuous montage playback. The actual `HTMLVideoElement.currentTime` can update the playhead while it remains inside the active clip's source boundaries.

## Boundaries

- Clicking a video clip or a ruler tick opens exactly that source position. Clicking a gap leaves the preview unchanged and displays a clear status.
- Audio-only clips are selectable, but currently cannot be previewed as video.
- A manual media-library selection clears the active timeline-to-source binding; source caption display remains attached to the selected source, not the edited montage.
- The player does **not** automatically switch video sources at a clip boundary or render multi-track audio/video. That requires a future playback coordinator, separate ADR, and native tests.
- This implementation does not modify the source file, render MP4 or upload content.

## Verification and budget

Pure mapping tests cover trimmed offsets, half-open boundaries, reused source assets, invalid frames, overlapping tracks, gaps and source clock mapping. Browser visual smoke triggers a timeline clip preview from actual React components with a Tauri test adapter. Native WebView playback/seek remains a manual acceptance gate. No new runtime dependencies, API services, model downloads, paid calls or media copies.
