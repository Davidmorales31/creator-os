# Creator OS — instructions for agents and future chats

> **Read this file before proposing or changing anything in this repository.**
> This file is a project guide, not a substitute for the user's original master plan, which has not yet been recovered.

## Source of truth and first steps

1. Open and inspect the **live** GitHub repository, including the current heads of `main` and `develop`, open issues/PRs and applicable GitHub Actions. Do **not** assume a commit/issue status from a previous chat is current.
2. Read [CONSTITUTION.md](CONSTITUTION.md), [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/architecture/ARCHITECTURE.md) and relevant [ADRs](docs/adr/).
3. Read [Project master context](docs/PROJECT_MASTER_PLAN.md) and the [Open-source integration register](docs/OPEN_SOURCE_INTEGRATIONS.md) before selecting libraries or starting a new feature. The [unapproved candidate research](docs/OPEN_SOURCE_CANDIDATE_RESEARCH.md) is exploratory and must **not** be confused with the owner’s unrecovered original list.
4. Read the [Google Drive master index](https://docs.google.com/document/d/1vq27TzAcozCOx2ec9aIMIcM3W6KKiRqOdstmszv5-Kc/edit?usp=drivesdk) **when Drive is available**. This is a companion index; **Git is authoritative for current code and technical progress**.

## The strategic decision that must not be forgotten

Creator OS's owner explicitly wants to **integrate and adapt existing, suitable open-source GitHub repositories** to build an end-to-end content creation desktop application, rather than recreating every subsystem from scratch. The current codebase already contains functional, original implementations and native tests: **preserve and reuse them until there is a reviewed migration plan**.

The owner's **original exact list of target repositories has not been recovered**. Never invent that list or claim any external project was selected or integrated just because it seems appropriate. When the owner supplies the original plan, reconcile it with the current architecture and record each approved dependency in `docs/OPEN_SOURCE_INTEGRATIONS.md`.

## Workflow policy

- **Only `develop`** is the active development branch. Open one direct PR from `develop` into `main`; do not create stacked feature branches/PRs.
- Do not merge while applicable CI, tests, architectural checks, native build checks, or visual review is pending or failed.
- After merge, fast-forward/synchronize `develop` with `main`, and verify the refs.
- Every new feature should start with a **reuse assessment**: existing Creator OS code, existing approved external project, compatibility, license, maintenance, size, security, privacy, long-term costs and adapters. Then integrate/adapt, or build the smallest missing component.
- Respect Creator OS-owned contracts and project formats. Domain logic stays free of React/Tauri/FFmpeg/AI framework coupling; UI uses typed application commands, providers are replaceable.
- Local-first, non-destructive source media, offline editing; no paid API, unapproved network upload, silent model download, or invented capability.
- New third-party code/weights need license, attribution and supply-chain review. Do not copy source without license compliance. Architecture decisions with high switching cost require an ADR.
- Do not conflate green Linux CI with complete native manual acceptance, general codec support or installer-readiness.

## Verified snapshot (not a live status)

As of 2026-11-04, `main` and `develop` were synchronized at `e1aafeb3124d2efb03e71134786dcd5cad780b5d` after PR #37 (v0.15). Linux native tests covered app startup, project persistence and FFprobe/import/VP8-VP9 playback. Issue #38 proposed the next native timeline/montage E2E. **Recheck these facts live before acting.**

## When the owner returns with the original plan

1. Read it in full; capture the owner's approved repository URLs and product priorities in `docs/PROJECT_MASTER_PLAN.md` and `docs/OPEN_SOURCE_INTEGRATIONS.md`.
2. Audit current Creator OS code against those repos. Preserve functionality, tests, formats and history; propose migration by module rather than replacing the whole application.
3. Resolve license compatibility, security and version-pinning before integration.
4. Update the Drive index as a readable companion; record authoritative implementation decisions in Git (issues, ADRs and code).

**Suggested prompt in a new chat:** “Abre el repositorio Davidmorales31/creator-os, lee AGENTS.md y el plan maestro, revisa el estado de Git y continúa desde el siguiente issue sin reconstruir lo que ya existe.”
