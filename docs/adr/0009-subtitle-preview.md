# ADR-0009 — Local subtitle overlay synchronized to source preview

- Status: Accepted
- Date: 2026-11-03
- Issue: #21, stacked on #19/PR #20

## Decision

Preview captions are **presentation overlays**, not media operations, timeline clips or embedded video subtitles. The React player queries already registered project transcript versions using typed `list_transcripts(projectId, assetId)`; the UI never reads arbitrary transcript paths or exposes them over the preview HTTP gateway.

A small pure TypeScript module `caption-cues.ts` chooses the active segment for a media clock in milliseconds. A cue occupies the half-open interval `[startMs, endMs)`. If recorded segments overlap, the later-starting segment takes precedence. Gaps display no caption. All computations are sourced from the media player's `HTMLVideoElement.currentTime`, including `timeupdate`, `seeked`, and direct scrubber interactions; no synthetic subtitle clock or polling is maintained.

The player selects a transcript version, enables/disables the overlay explicitly, and uses normal React text rendering (no `dangerouslySetInnerHTML`), preserving line breaks. The overlay is pointer-transparent, accessible as a labeled group, and styled with shared semantic design tokens. The player defaults to CC off and shows available/offline/error states.

Transcriptions completed in the same editing session invalidate the player query through a lightweight revision signal. Queries are canceled logically on project/media/revision changes, preventing stale responses from appearing over unrelated assets. No new worker or binary, no network request beyond the existing local Tauri command.

## Limitations and non-goals

- The caption clock refers to the **selected source video**, not the edited timeline montage. Timeline-linked captions require a mapping of source in-points and track offset and belong to a later issue.
- No video re-encoding, burn-in, subtitle tracks in MP4, word alignment, diarization, font rendering configuration, or persisted subtitle enablement.
- The browser screenshot fixture verifies initial cue display and seeking past its end on real HTML video, using test transcriptions. Native WebView validation remains a release gate.

## Cost and compliance

No API costs, no new Rust/Python dependencies, no media copies, and a tiny in-memory segment lookup. UI obeys Constitution requirements for light/dark tokens, disabled/error states, keyboard controls, reduced-motion, and screenshot review. Domain text is not interpreted as HTML.
