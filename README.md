# Creator OS

Creator OS is a local-first, open-source workspace for creators: scripting, voice, editing, shorts, thumbnails, publishing, and analytics in one desktop application.

## Status

`v0.0.1` — foundation phase.

## Core principles

- Local-first by default.
- macOS-native feel, Creator OS identity.
- Domain logic is independent from UI, frameworks, media engines, AI models, and social APIs.
- AI proposes typed operations; the core validates and executes them.
- Every difficult-to-reverse architecture decision requires an ADR.

See [`CONSTITUTION.md`](./CONSTITUTION.md) and [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md).

## Planned stack

- Desktop: Tauri v2 + React + TypeScript
- Core: Rust
- AI worker: Python
- Data: SQLite
- Media: FFmpeg adapter
- Local AI: provider-based (Ollama, Whisper, voice engines, etc.)

## Repository layout

```text
apps/desktop/       Desktop UI and Tauri shell
packages/           Shared TypeScript packages and design system
crates/             Rust domain/application/infrastructure crates
ai/worker/          Local Python AI worker
docs/architecture/  Architecture documentation
docs/adr/           Architecture Decision Records
```

## Development state

The repository is intentionally starting small. The first milestone is a reliable project system: create, save, close, reopen, and migrate Creator OS projects before adding editing or AI features.

## License

MIT for Creator OS-owned code unless a file states otherwise. Third-party components retain their original licenses and notices.
