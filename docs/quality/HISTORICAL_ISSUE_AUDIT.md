# Historical issue reconciliation — evidence inventory (preliminary)

- Date: 2026-11-06
- Tracking: [Issue #53](https://github.com/Davidmorales31/creator-os/issues/53)
- **Status: IN PROGRESS.** This document is an evidence index, **not** a blanket acceptance of historical issues.
- Current technical source: `main`, Creator OS v0.19 after PR #52. The original planned external repositories have not been recovered (#41).

The historical backlog still contains issues for implemented or partially implemented features. Closing them solely because the README mentions the feature would be misleading. Read each original issue's acceptance criteria and compare typed contracts, provider behavior, test cases, manual native UI and remaining limits.

| Existing open issue | Implementation already present | Gaps still to verify before closure |
| --- | --- | --- |
| [#2 — media import](https://github.com/Davidmorales31/creator-os/issues/2) | `apps/desktop/src-tauri/src/media_repository.rs`, `crates/media-core`; real VP8/VP9 Tauri import E2E | Original criteria also name **audio/image files**, metadata, error mapping and non-duplication for all supported kinds; real file chooser is separate #54 |
| [#3 — preview](https://github.com/Davidmorales31/creator-os/issues/3) | `apps/desktop/src/player.tsx`, WebKitGTK video playback/seek, Fit/Fill, typed preview URL gateway, theme | Verify documented keyboard play/seek behavior, explicit unsupported-media errors, accessibility and nonvideo states |
| [#4 — timeline](https://github.com/Davidmorales31/creator-os/issues/4) | Pure `crates/timeline-core/src/lib.rs`: stable clip/track IDs, apply/undo/redo; `apps/desktop/src/timeline-panel.tsx`; native montage E2E | Verify all move/split/trim/delete edge cases, serialization/history on reopen and source-file immutability |
| [#15 — MP4 export](https://github.com/Davidmorales31/creator-os/issues/15) | `crates/render-core`, `export_jobs.rs`, `export_adapter.rs`, export UI; v0.18 H.264/AAC and v0.19 cancel E2E | Check original typed unsupported-track/format failures, atomic publish, no silent overwrite, and all UI states; do not claim multitrack support |
| [#17 — transcription](https://github.com/Davidmorales31/creator-os/issues/17) | `crates/transcript-core`, `transcription_jobs.rs`, `transcription-panel.tsx`, optional Python worker | Test voluntary model download, CPU/offline behavior, local persistence, worker cancellation, error codes and no unapproved model downloads |
| [#19 — subtitles SRT/VTT](https://github.com/Davidmorales31/creator-os/issues/19) | `crates/transcript-core/src/subtitles.rs`, `subtitle_commands.rs`, SRT/VTT export buttons | Confirm hour-long times, Unicode, empty/overlap behavior, ID validation, no overwrite and exact file paths in tests |
| [#21 — selected-video CC](https://github.com/Davidmorales31/creator-os/issues/21) | `apps/desktop/src/caption-cues.ts`, `player.tsx`: `video.currentTime`, transcript selection, CC overlay | Confirm stale async response/race and native manual acceptance. **Montage-synchronized CC** is separate #55 and is not implemented merely by this feature |

## Audit protocol

For each issue, add exact source file references and relevant test/CI links, match **each** acceptance bullet and record status **complete / partial / blocked**. Only then close issues with a factual summary and commit evidence. If a criterion was superseded, say so explicitly and retain a linked follow-up issue. Preserve old descriptions for provenance; never rewrite history to make a partial feature look completed.

The [ten-step roadmap](https://github.com/Davidmorales31/creator-os/issues/60) calls this step 3. Work on substantive new modules requires the original upstream shortlist assessment in [#41](https://github.com/Davidmorales31/creator-os/issues/41). This report makes no external package selections and introduces no dependencies.
