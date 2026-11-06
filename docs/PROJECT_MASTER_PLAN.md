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

## Updated snapshot confirmed on 2026-11-06

- **v0.17** Issue [#45](https://github.com/Davidmorales31/creator-os/issues/45) / [PR #46](https://github.com/Davidmorales31/creator-os/pull/46) merged at `7d13dd768290fff8ae085f3d48f3a4ede602f694`: focused timeline keyboard shortcuts with native WebDriver E2E.
- **v0.18** Issue [#47](https://github.com/Davidmorales31/creator-os/issues/47) / [PR #48](https://github.com/Davidmorales31/creator-os/pull/48) merged at `54d0335abe21bc40cd7dab218666bcf362752071`: real Tauri FFmpeg MP4 export E2E on Linux. Independent FFprobe H.264/AAC, 1920×1080, 30 FPS, 4.0 seconds, unchanged source SHA-256, no partial files. [CI](https://github.com/Davidmorales31/creator-os/actions/runs/42223830589) and [native E2E](https://github.com/Davidmorales31/creator-os/actions/runs/42223830662) passed.
- `main` and `develop` synchronized at `54d0335abe21bc40cd7dab218666bcf362752071` after PR #48. **Historical snapshot only — always check live GitHub.**
- **Issue [#41](https://github.com/Davidmorales31/creator-os/issues/41) remains open**: the exact upstream GitHub repositories chosen by the owner have not been recovered. Candidate research must not be confused with prior approvals; do not replace functioning modules without the original plan and audit.
- Manual native acceptance on Linux, Windows and macOS, end-user installers, render cancellation, multitrack compositing, and gapless/frame-perfect editing remain unverified.

## v0.19 verified snapshot — 2026-11-06

- [PR #52](https://github.com/Davidmorales31/creator-os/pull/52) merged and Issue #51 closed, release-testing milestone v0.19. Exact merge commit `08120e50e61244eeee2efef5dc62fec04276d27b`, with `main` and `develop` synchronized, zero open PRs **at time of verification**.
- [CI](https://github.com/Davidmorales31/creator-os/actions/runs/42234728299), [native Tauri/WebKitGTK cancellation](https://github.com/Davidmorales31/creator-os/actions/runs/42234728507) and [visual review](https://github.com/Davidmorales31/creator-os/actions/runs/42234728340) all passed. Real FFmpeg jobs were cancelled twice, with no orphan process/MP4, typed `export_busy`, new export started after cancellation and SHA-256 originals unchanged.
- Rust CI's Linux APT setup is now bounded and skips installed dependencies; native smoke captures actual painted UI. Green Linux CI is not general Windows/macOS or installer acceptance.
- [Ten-step roadmap #60](https://github.com/Davidmorales31/creator-os/issues/60) created and steps 1–2 completed. [Legacy issue audit #53](https://github.com/Davidmorales31/creator-os/issues/53) started; its original issues remain open until every acceptance criterion is checked.
- [Upstream recovery #41](https://github.com/Davidmorales31/creator-os/issues/41) **still pending**; exact original repo shortlist is unknown. New subsystem additions must not pretend exploratory candidates are approved. Test-only/quality changes to current Creator OS code may continue.
- Later open steps: GTK chooser #54, montage captions #55 (blocked by #41), interrupted-export recovery #56, Linux distribution #57, Windows #58, macOS #59.

**This snapshot is not a promise that those refs/issues remain unchanged. Check GitHub.**

## Required reconciliation when original plan arrives

- Preserve the original text and all repository URLs as source material, with date and provenance.
- Populate [the integration register](OPEN_SOURCE_INTEGRATIONS.md) and distinguish “historically selected”, “currently proposed”, “approved”, “integrated”, “rejected” and “replaced”.
- Compare requirements against existing code and versioned project data to avoid incompatible rewrites.
- Prioritize modules by user value, integration feasibility and test coverage.
- Ask for missing strategic decisions rather than inventing them.

## Context continuity

A future chat can review this repository with an available GitHub connection and the companion Google Doc with Drive access. **Automatic retrieval in every future chat is not guaranteed.** Explicitly requesting “Lee primero AGENTS.md y el plan maestro de Creator OS en Git” is the reliable handoff.
