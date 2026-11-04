# Creator OS — master plan and source-of-truth rules (PROVISIONAL)

**Status:** Provisional working context. The owner is retrieving the original complete plan, including the **specific GitHub repositories originally selected**. Do not mistake this summary for that original plan.

## Strategic intent (confirmed by owner)

Creator OS should be built by **reusing and integrating maintained, license-compatible open-source GitHub projects** as appropriate. Avoid recreating functioning subsystems unless an integration assessment shows a genuine reason. Existing Creator OS features and tests are real assets; they must not be discarded without a reviewed migration.

The owner wants a coherent, local-first desktop application for content creation and editing, with modules such as timeline/video workflows, subtitles and optional local AI, but the original precise modular architecture, original repo shortlist and final product scope must be recovered from the owner.

## Canonical locations

- GitHub repository: https://github.com/Davidmorales31/creator-os
- Required agent entrypoint: [AGENTS.md](../AGENTS.md)
- Architecture: [docs/architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md)
- Non-negotiable constitution: [CONSTITUTION.md](../CONSTITUTION.md)
- Historical architectural decisions: [docs/adr](adr/)
- Existing quality evidence: [docs/quality](quality/)
- External repository decisions: [OPEN_SOURCE_INTEGRATIONS.md](OPEN_SOURCE_INTEGRATIONS.md)
- Newly researched **unapproved** candidates (not the original list): [OPEN_SOURCE_CANDIDATE_RESEARCH.md](OPEN_SOURCE_CANDIDATE_RESEARCH.md)
- Drive companion index: https://docs.google.com/document/d/1vq27TzAcozCOx2ec9aIMIcM3W6KKiRqOdstmszv5-Kc/edit?usp=drivesdk

GitHub code, commits, issues, PR checks and ADRs are the authoritative source for **current technical state**. Drive is a cross-chat reading aid. Check GitHub live each session, because this document is a snapshot.

## Non-negotiable development rules

1. Domain independent of React, Tauri, FFmpeg and AI vendors; application-owned typed commands and replaceable adapters.
2. Local-first, original media immutable and offline basic editing. No paid APIs or implicit model downloads. Account for CI/CPU/storage/license costs.
3. Check suitable approved code in existing Creator OS and third-party repositories *before* building custom replacement modules.
4. Evaluate every third-party component's license, maintainers, upstream activity, version/commit, vulnerabilities, binary redistribution, portability, accessibility, adapter boundaries and replacement path.
5. Work only on `develop`; direct PR `develop → main`; merge only after all applicable checks pass, then resynchronize `develop`.
6. Record irreversible choices in ADRs; do not rewrite the accepted ADR history to conceal changes.
7. Do not claim testing of Windows/macOS, installers, codecs or flows that were not actually exercised.

## Historical origin (user-provided conversation excerpt)

The original GitHub repository was created as `Davidmorales31/creator-os`. The user-provided transcript records a foundation commit beginning `532c61e` with `CONSTITUTION.md`, ADR-0001, CI, monorepo pnpm, React/TypeScript, Tauri/Rust, Python/FastAPI, design tokens and MIT licensing. The initial backlog included Issue #1 Project System, #2 Media Import, #3 Player/Preview and #4 Timeline; PR #5 then implemented a versioned `project.json` and typed native project commands. These are **historical notes from the user**, not a claim that the earlier feature branch or CI state is current.

## Snapshot confirmed on 2026-11-04

- Linux Tauri release startup, project persistence, FFprobe VP8/VP9 playback and real **two-clip VP8→VP9 timeline montage** E2E passed CI.
- PR [#40](https://github.com/Davidmorales31/creator-os/pull/40) merged; Issue #38 closed. Also repaired the real Rust/TypeScript `TimelineOperation` camelCase argument mismatch with regression tests.
- `main` and `develop` synchronized at `89c61eb0fed216a1dcc7753bf9890690bb796b34` after #40. This is a **historical snapshot; recheck live**.
- Issue [#41](https://github.com/Davidmorales31/creator-os/issues/41) remains **open**: recover the owner's original selected open-source GitHub repositories and audit integration/licensing before new product modules.
- Important remaining gates: native manual acceptance on Linux/Windows/macOS; external upstream shortlist and integration plan; no frame-perfect/gapless guarantee or release installers.

**This snapshot is not a promise that those refs/issues remain unchanged. Check GitHub.**

## Required reconciliation when original plan arrives

- Preserve the original text and all repository URLs as source material, with date and provenance.
- Populate [the integration register](OPEN_SOURCE_INTEGRATIONS.md) and distinguish “historically selected”, “currently proposed”, “approved”, “integrated”, “rejected” and “replaced”.
- Compare requirements against existing code and versioned project data to avoid incompatible rewrites.
- Prioritize modules by user value, integration feasibility and test coverage.
- Ask for missing strategic decisions rather than inventing them.

## Context continuity

A future chat can review this repository with an available GitHub connection and the companion Google Doc with Drive access. **Automatic retrieval in every future chat is not guaranteed.** Explicitly requesting “Lee primero AGENTS.md y el plan maestro de Creator OS en Git” is the reliable handoff.
