# Architecture

Creator OS uses a local-first desktop architecture with strict dependency boundaries.

## Layers

```text
UI (React/Tauri)
      |
      v
Application (commands, queries, use cases)
      |
      v
Domain (pure business rules)

Infrastructure and Providers implement ports owned by the application/domain layers.
```

Forbidden dependencies include `domain -> React`, `domain -> Tauri`, `domain -> FFmpeg`, `domain -> Ollama`, and `domain -> YouTube`.

## Technology decisions

- Desktop shell: Tauri v2
- UI: React + TypeScript
- Core: Rust
- AI worker: Python
- Database: SQLite
- Media engine: FFmpeg adapter
- AI/social/stock systems: provider interfaces

## Runtime responsibilities

Rust owns project state, filesystem boundaries, timeline semantics, typed commands, validation, persistence orchestration, and media jobs. Python owns AI inference and model adapters. React owns presentation and user interaction only.

## AI safety boundary

AI systems return structured operation proposals. Example:

```json
{
  "operations": [
    {"type": "remove_silences", "threshold_ms": 700},
    {"type": "add_zoom", "at_ms": 24500, "scale": 1.15}
  ]
}
```

The application layer validates authorization, preconditions, schema, reversibility, and project state before executing anything.

## Project format

Creator OS owns a versioned project schema. Third-party editor project formats may be imported through adapters but are never the canonical internal format.

## ADR policy

Any difficult-to-reverse decision affecting architecture, persistence, public APIs, licensing, security, plugin boundaries, or deployment must be recorded in `docs/adr/`.
