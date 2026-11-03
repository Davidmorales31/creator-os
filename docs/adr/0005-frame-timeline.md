# ADR-0005 — Frame-indexed Creator OS timeline and reversible commands

- Status: Accepted
- Date: 2026-11-03

## Context

Creator OS needs timeline editing without destructive mutation of source media. Floating-point seconds make editing and undo unreliable at exact boundaries. The project format currently holds an ownable, versioned manifest. All editor mutations must be validated by a framework-independent core.

## Decision

- `creator-os-timeline-core` is pure Rust and owns `Timeline`, `Track`, `Clip`, and a serializable tagged `TimelineOperation` command.
- Time values are **integer frames** in the project's rationally fixed FPS (currently integer FPS from project settings). Positions are absolute on the timeline; source trims are separate non-destructive offsets.
- Every operation is transactional in memory: validate old state, apply to a clone, validate next state, record bounded snapshot history, then replace.
- Edits are revision-gated (optimistic concurrency). A shared desktop mutex serializes the read/modify/write cycle. Unsupported source lengths, incompatible tracks, duplicate IDs, overlaps, and range overflows are rejected.
- Undo/redo is persisted with the timeline in `project.json`, limited to the last 50 snapshots; redo history is invalidated by a new edit.
- Schema version 2 adds `timeline` to `project.json`. Existing version 1 manifests default to empty tracks and are upgraded on opening.
- Desktop validates `AddClip` against the project's media catalog. Operations never alter the original media files or ask FFmpeg to edit.
- React renders the timeline with lightweight controls. Drag-based editing, snapping, transitions, linked AV streams, true rational rates (23.976/29.97), proxy playback, and export remain later milestones.

## Consequences

Undo/redo snapshots occupy more manifest space than a long-term action journal; the 50-step cap bounds this cost. A future ADR can introduce action-journal compaction after profiling real projects. CI must check domain tests and ensure the new crate participates in workspace fmt/clippy/test.

## Testing

Domain tests cover add/move/split/trim/delete, undo/redo and JSON serialization, overlap rejection, stale revision rejection, invalid track, invalid source boundaries, and bounded history. Desktop integration requires visual capture and a native manual pass.
