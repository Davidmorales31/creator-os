# ADR-0007 — Local speech-to-text worker and transcript storage

- **Status:** Accepted
- **Date:** 2026-11-03
- **Issue:** #17
- **Dependencies:** ADR-0001 through ADR-0006 remain valid.

## Decision

Creator OS owns transcript semantics in a pure, versioned Rust contract (`crates/transcript-core`) and a framework-independent Python validation contract (`ai/worker/src/creator_os_ai_worker/transcript.py`). Temporal anchors are **integer milliseconds**. Transcription does **not** edit the timeline or any original media.

`faster-whisper` is an optional Python adapter behind `SpeechProvider`, not a domain dependency. For the first implementation the supported CPU models are `tiny`, `base`, `small` with `int8`, capped at four CPU threads. Language is selected from Spanish, English, or auto-detect. Future providers are free to implement the same contract.

Model weights are **not downloaded without explicit user permission**. `local_files_only=True` is used by default. A first-use download requires opting into the UI checkbox. After weights have been cached, the provider can operate offline. Initial model downloads contact external model hosts; the software does not upload user media or transcript text to an inference API.

The Tauri command accepts only a registered `projectId` and `assetId`. Rust validates project/catalog ownership and audio-stream metadata; it retrieves the original canonical source path itself and passes a trusted argv vector to a local one-shot Python subprocess. The UI never passes arbitrary filesystem paths or executes a shell.

A single transcription may run at once. The desktop surfaces typed states and errors and cancels by terminating the worker. Job results are written to a unique temporary file, validated and stored as an immutable transcript record under `projects/<id>/audio/transcripts/<job-id>.json`. Failed/cancelled jobs remove temporary files and do not overwrite successful transcripts. Records can be reopened after restarting the desktop app.

## Explicit MVP boundaries

- Segment-level timestamps only. Word alignment, speaker diarization, SRT/VTT publishing, automatic subtitle track placement, AI edits and silence deletion are separate issues.
- No background progress percentage is invented. The job shows indeterminate progress until success/failure/cancel.
- Python and `faster-whisper` are **not bundled**. Users install an optional worker extra. Separate packaging and dependency-licensing ADRs are required before installers are distributed.
- No silent model downloads. No cloud inference. GPU acceleration is future provider/configuration work.
- Native desktop shutdown/process cleanup requires a manual test; CI tests pure boundaries and screenshot UX with mock data, not a real downloaded model.

## Cost, privacy and performance

| Resource | Policy |
| --- | --- |
| Cloud inference or third-party API | $0 |
| Local CPU | up to 4 inference threads |
| RAM | model-dependent; choose tiny/base on constrained devices |
| Disk | cached model weights and versioned transcript JSON |
| Network | none after models have been cached; first model download only after explicit consent |
| Concurrency | one local transcription at a time |
| Original media | referenced in-place, never mutated |
| Dependencies | optional faster-whisper, CTranslate2 and model-weight licenses reviewed before packaging |

See the provider documentation at https://github.com/SYSTRAN/faster-whisper and the project constitution.
