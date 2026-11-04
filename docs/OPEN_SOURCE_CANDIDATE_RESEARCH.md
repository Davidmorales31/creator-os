# Creator OS — upstream research, NOT the original approved repository list

> **Preliminary technical reconnaissance as of 2026-11-04.** Applies to [Issue #41](https://github.com/Davidmorales31/creator-os/issues/41). None of the projects below has been identified as a repository chosen in the owner's original plan. **No dependency was installed, copied, vendored, downloaded or approved for integration.** GitHub repository metadata and latest commits were verified on 2026-11-04; this is a dated snapshot, not a substitute for checking upstream before a decision.

## Why this assessment exists

The owner asked to build Creator OS by integrating and adapting suitable open-source repositories rather than reinventing whole subsystems. The exact previously approved upstream list remains unrecovered after checking the project's Google Drive folder and current GitHub project documentation. This file only identifies **new exploratory candidates** and records evidence that can be compared later with the original list. See [AGENTS.md](../AGENTS.md), [project master](PROJECT_MASTER_PLAN.md), and the authoritative [approved integration register](OPEN_SOURCE_INTEGRATIONS.md).

### What Creator OS already implements — preserve it

| Current capability | Existing Creator OS evidence | Reuse implication |
| --- | --- | --- |
| Multi-track **data model** and basic timeline operations | `crates/timeline-core/src/lib.rs`; `apps/desktop/src/timeline-panel.tsx`; Tauri `edit_timeline` | Do not replace the schema or undo history just to obtain prettier handles/dragging |
| Continuous single-video-track **montage preview** | `apps/desktop/src/montage-plan.ts`, `montage-handoff.ts`, `player.tsx`; Linux native VP8→VP9 E2E | Do not pretend a new engine is required for the current bounded use case |
| Basic FFprobe/FFmpeg import and MP4 export | existing Rust adapters/commands; manual acceptance remains pending | Evaluate richer multitrack compositing separately, not by silently swapping the CLI tool |
| Local transcription and SRT/VTT / caption overlay | optional `faster-whisper` worker, subtitle exporter and preview components | New STT/subtitle stack requires measurable value and a migration/adapter plan |
| Desktop native quality gates | Tauri Linux smoke, project E2E, media VP8/VP9 E2E, montage E2E | Preserve tests; they do **not** certify all codecs, Windows/macOS or installers |

## Candidate comparison (all unapproved)

| New candidate / source | License reported by GitHub | Latest repository activity and version verified 2026-11-04 | Potential fit | Main integration blocker / decision |
| --- | --- | --- | --- | --- |
| [katspaugh/wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) | BSD-3-Clause | commit `9fbcf154` (2026-11-03); release `8.0.5` (2026-11-02) | Audio waveform, regions, scrubbing visualization in React WebView | Does not replace the Rust timeline or audio mixing. Benchmark memory with long files, platform audio policies and offline waveform generation; **research first** |
| [xzdarcy/react-timeline-editor](https://github.com/xzdarcy/react-timeline-editor) | MIT | commit `4148f4a8` (2026-01-25); release `v1.0.0` (2026-01-25) | React timeline UI surface, draggable clips and geometry | Data model, drag semantics, React version, accessibility, virtualized performance and undo/redo adapters must be checked; **possible UI adapter, not replacement schema** |
| [mltframework/mlt](https://github.com/mltframework/mlt) | LGPL-2.1 (framework; components/modules may have different licenses) | commit `7a3319fc` (2026-10-29); release `v7.42.0` (2026-10-03) | Mature multitrack audio/video composition and effects backend | C/C++/FFmpeg native build and packaging complexity, plugins/codec license obligations, Windows/macOS distribution and mapping project JSON. **Only assess for future advanced render requirements** |
| [ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT (code; model weights separately) | commit `4da27c41` (2026-11-03); release `v1.9.5` (2026-10-06) | CPU-local offline transcription backend alternative | Existing optional `faster-whisper` works. Assess latency, memory, model-weight terms and explicit download consent before choosing a provider |
| [laubonghaudoi/subtitle-editor](https://github.com/laubonghaudoi/subtitle-editor) | MIT | commit `4f203484` (2026-09-15); no latest GitHub release returned | SRT/VTT editing UX, waveform/synchronization concepts, React source | Whole Next.js application, not proven embeddable package. Assess code extraction/attribution, existing CC overlays, bundling and design fit; **do not copy wholesale** |
| [Ektie/react-video-timeline-editor](https://github.com/Ektie/react-video-timeline-editor) | AGPL-3.0 | commit `2876697a` (2026-09-21); no latest GitHub release returned | Multitrack editor UI + project document and captions | **High license and integration review needed** before embedding into MIT-owned code/distribution. Young repository, maintenance and artifact maturity unproven. No adoption decision |

Release dates are GitHub release metadata, not assurance of vulnerability-free packages. Repository activity dates do not, by themselves, prove long-term maintainability. Commit prefixes above are *research snapshots*; any actual dependency must be pinned to a reviewed full SHA or immutable release artifact in its own approval PR.

## Integration triage: what to investigate, not what to install

1. **Audio UX**: WaveSurfer is a promising *limited-surface* technical spike for waveform/regions visualization. Prefer an adapter that reads metadata or decoded peaks without turning browser state into the source of truth. Test with synthetic long audio and prevent accidental media rewriting.
2. **Timeline UX**: Compare xzdarcy against the **existing** Creator OS panel for drag/trim/zoom/accessibility, weighing React 19, event/reducer compatibility, dependency count and how to preserve Rust's current project format, commands and undo history. Only prototype behind an adapter if benefit exceeds migration risk.
3. **Advanced multitrack render**: MLT is relevant if a new requirement for true compositor/multitrack effects is approved. Legal and packaging diligence are prerequisites; do not assume the framework's LGPL designation covers every runtime module, FFmpeg build or preset.
4. **Transcription**: Whisper.cpp is a conditional alternative provider, not an automatic migration away from `faster-whisper`. Keep user consent for model files and compare real CPU workloads before a decision.
5. **Captions UX**: The subtitle-editor project can inform interaction design, but must be evaluated as a separately maintained application, not automatically imported as a library.
6. **AGPL editor**: Ektie is a *license review hold*, not a direct MIT-compatible drop-in. Obtain a clear distribution/source-compliance decision before any embedding.

## Non-negotiable evaluation gates for every upstream

- Confirm exact owner-approved original repo URL **versus** a newly discovered suggestion. Do not label either as approved without evidence.
- License details (SPDX and original license text), third-party transitive dependencies, patent/codec and model-weight constraints, package signing/provenance, commercial distribution scenarios and notice obligations.
- Active maintenance, releases, supported platform versions, security policy, known advisories, reproducible build and pinned full commit/tag. A license label or star count alone is insufficient.
- Creator OS source-media immutability, offline UX, data schema migration and rollback, typed Rust/Tauri adapter, undo/redo, UI design tokens and accessibility.
- Budget: paid API cost must remain $0 absent explicit decision; local CPU, bundle size, disk space, CI minutes and artifact storage are **not** free.
- Required proof before migration: isolated synthetic fixture, benchmark, unit and real Tauri WebKitGTK E2E plus manual cross-platform testing as applicable.
- Keep changes on `develop` and use a single `develop → main` PR with green checks before integration.

## Decision state / next dependency

**No decisions have been made.** In particular, the table above **is not the historical agreed shortlist**. The user must provide or locate the original master plan; preserve its exact source text/URLs and compare them against this research. Then update [OPEN_SOURCE_INTEGRATIONS.md](OPEN_SOURCE_INTEGRATIONS.md) with explicit historical/candidate/approved statuses, version pins, ADRs, license reviews and issue references. Issue #41 stays open until that happens.

### Primary sources (snapshot)

- https://github.com/katspaugh/wavesurfer.js and https://github.com/katspaugh/wavesurfer.js/blob/main/LICENSE
- https://github.com/xzdarcy/react-timeline-editor and https://github.com/xzdarcy/react-timeline-editor/releases/tag/v1.0.0
- https://github.com/mltframework/mlt and https://mltframework.org/
- https://github.com/ggml-org/whisper.cpp and https://github.com/ggml-org/whisper.cpp/releases/tag/v1.9.5
- https://github.com/laubonghaudoi/subtitle-editor
- https://github.com/Ektie/react-video-timeline-editor
