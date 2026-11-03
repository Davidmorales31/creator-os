# ADR-0002 — Project persistence uses Creator OS-owned filesystem format

- Status: Accepted
- Date: 2026-11-03

## Context

Creator OS needs a first reliable vertical slice before editor/media work begins. The project system must create, persist, list, and reopen local projects without coupling the domain model to Tauri, React, SQLite, or any external framework.

## Decision

The first project persistence adapter stores one versioned `project.json` file per project under Creator OS application data. The domain model lives in `crates/project-core`; the Tauri shell owns the filesystem adapter and exposes typed commands to the UI.

The first version does not require SQLite. SQLite remains available for future indexes, search, analytics, and high-volume metadata where it provides clear value.

## Consequences

- Project files are inspectable and migration-friendly.
- The domain model stays independent from desktop/runtime concerns.
- Replacing or augmenting persistence later does not change the UI contract.
- Recent projects can initially be derived by scanning project manifests.
- Any future persistence change must preserve project schema versioning and include a migration path.
