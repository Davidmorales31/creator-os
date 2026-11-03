# ADR-0001: Creator OS foundation architecture

- Status: Accepted
- Date: 2026-11-03

## Context

Creator OS must handle heavy local media, local AI, desktop-native filesystem access, and multiple replaceable integrations while remaining understandable to contributors.

## Decision

Use React + TypeScript for UI, Tauri v2 for the desktop shell, Rust for core/application/infrastructure boundaries, Python as a local AI worker, SQLite for local persistence, and FFmpeg behind a media adapter.

The product is local-first. External AI, stock, and social systems are implemented as providers behind Creator OS-owned interfaces.

## Consequences

- UI remains replaceable and does not own domain state.
- AI engines can change without rewriting core workflows.
- Media processing can evolve independently from project semantics.
- Contributors need Node/TypeScript, Rust, and Python toolchains.
- IPC contracts must be explicitly typed and versioned.

## Rejected alternatives

- Electron as the default shell: rejected for the initial architecture due to resource overhead and weaker alignment with the Rust media/core direction.
- Python-only desktop application: rejected because the editor/media core benefits from Rust performance and stronger native integration.
- Microservices: rejected for v1 because Creator OS is a local desktop product, not a distributed backend.
