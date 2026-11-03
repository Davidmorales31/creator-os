# ADR-0012 — Sequential, single-track montage playback

- Status: Accepted
- Date: 2026-11-03
- Issue: #28
- Builds upon: ADR-0001 through ADR-0011

## Context

The v0.10 editor maps a selected timeline clip to a registered source preview, but it cannot play a series of clips. A native editing experience requires first-class sequence playback without pretending to provide compositing, mixing, or perfect gapless frame accuracy.

## Decision

`apps/desktop/src/montage-plan.ts` is a pure TypeScript planner over Creator OS's existing versioned timeline and registered media catalog. It is independent of React, Tauri, FFmpeg and network. It supports one populated video track, clips contiguous from timeline frame 0, and validated source trim bounds. Empty timelines, gaps, overlaps, populated audio tracks, images, unknown media and unsupported FPS return explicit, user-visible errors.

`App` owns **one** montage session: unique run ID, immutable plan snapshot (timeline revision and FPS), current segment index. `TimelinePanel` starts/stops that session and updates the visual playhead using mapped source time. `MediaPlayer` consumes the active segment, seeks its **existing local authenticated preview URL**, calls the native HTML video element's `play()`, and detects the segment end using `currentTime` and `ended` events. It notifies the coordinator to advance to the next segment, including when consecutive clips reuse the same imported asset. Explicit stop, changed project/media, or timeline edit cancels the session.

The selected clip's source clock is authoritative; no synthetic timer drives the video frame. A montage request pauses and seeks source playback; the player's normal source seek/play controls are disabled while a montage is active. The UI labels the mode distinctly and does not claim to render a finished montage.

## Explicit limitations

- **Not gapless or sample/frame-perfect across clip boundaries.** A WebView switching URLs/decoders can pause or show a short transition. Proxy and compositor pipelines are future milestones.
- No multi-video compositing, transitions, separate audio-track mixing, word-level caption alignment, or baked-in subtitles.
- Audio attached to an individual video may play; separate audio tracks cause an explicit unsupported error instead of being ignored.
- No FFmpeg processing occurs in the preview. FFmpeg remains in the export adapter only.
- Native manual playback/seek and cancellation acceptance on Linux, Windows and macOS remains release-blocking, despite CI/native compilation success.

## Tests and costs

The deterministic planner suite checks ordering, trims, frame bounds, source reuse, different sources, extra tracks and malformed timelines. Chromium tests use a mocked native bridge and actual HTML video DOM events for a two-clip handoff. CI checks TypeScript, Rust, Python, visual snapshots and Linux Tauri release compilation.

Infrastructure/API spend is zero. Memory/CPU usage belongs to the local WebView decoder, with no duplication of media files or new model downloads.
