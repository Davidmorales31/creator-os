# Contributing to Creator OS

Creator OS is intentionally strict about architecture because the product combines media editing, local AI, desktop integration, and external platforms.

Before contributing:

1. Read `CONSTITUTION.md`.
2. Read `docs/architecture/ARCHITECTURE.md`.
3. Check existing ADRs before introducing a new framework, persistence strategy, provider boundary, or public contract.
4. Keep domain logic independent from UI/framework/infrastructure code.
5. Add tests for new behavior.
6. Verify third-party licenses before adding dependencies or model weights.

## Pull requests

A PR should explain what changes, why it belongs in the chosen layer, how it was tested, and whether it changes architecture or licensing. Difficult-to-reverse decisions require an ADR in the same PR.

## Commit style

Prefer focused conventional-style commits such as `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, and `chore:`.
