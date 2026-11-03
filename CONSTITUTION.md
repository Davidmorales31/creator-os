# Creator OS Constitution

This document defines non-negotiable project rules. Changes require an accepted ADR.

## I. Creator UI Law

1. Native-feeling, not macOS cosplay.
2. Content is more important than chrome.
3. One clear primary action per context.
4. Sidebar is global navigation; toolbar is contextual action space.
5. Inspector is contextual and never becomes a second navigation system.
6. Light and dark modes are first-class designs.
7. Spacing follows an 8pt grid unless a documented exception exists.
8. Radius, elevation, blur, motion, typography, and color come from design tokens.
9. Components may not invent local colors or spacing values without adding tokens.
10. Frequent actions must be keyboard-accessible.
11. Drag and drop is used only where users are conceptually moving content.
12. Destructive editor operations require undo/redo support.
13. Loading, empty, error, disabled, and offline states are mandatory.
14. Accessibility and contrast are release requirements.
15. Motion must communicate state, causality, or hierarchy.
16. Prefer inspector/popover over modal when the task does not require blocking context.
17. Ambiguous icons require tooltips.
18. New repeated UI patterns become reusable design-system components.
19. New screens require visual review before merge.
20. Apple HIG principles plus Creator OS design tokens define the visual authority.

## II. Creator Architecture Law

1. Domain logic never depends on UI, Tauri, FFmpeg, AI models, databases, or social APIs.
2. Dependencies point inward toward the domain.
3. UI calls typed application commands/queries, never infrastructure directly.
4. External systems implement Creator OS-owned provider interfaces.
5. The Creator OS project format and timeline model are owned by Creator OS.
6. LLMs never mutate files or timelines directly; they propose typed operations that the core validates.
7. Editor operations must be deterministic, serializable, and compatible with undo/redo.
8. Modules never reach into another module's database tables behind its public API.
9. Framework types do not enter the domain layer.
10. FFmpeg is a replaceable media backend, not the product architecture.
11. AI engines are replaceable providers.
12. Social integrations are replaceable providers.
13. Local-first is the default architecture.
14. Editing, projects, and supported local AI features must remain usable offline.
15. Secrets and tokens never enter source control or project files.
16. Database and project-format migrations are versioned.
17. Breaking format changes require migration paths.
18. Temporary cross-layer shortcuts are prohibited in merged code.
19. Circular dependencies are prohibited.
20. God services and god files are prohibited.
21. Prefer small duplication over premature shared abstractions.
22. Measure performance before optimization.
23. Internal APIs require explicit types/contracts.
24. Cross-boundary failures are represented as typed application/domain errors.
25. Use structured logging; console logging is not an observability strategy.
26. Domain/core tests run without launching UI or network services.
27. Pull requests that fail typecheck, lint, tests, or architecture checks do not merge.
28. New dependencies require license, maintenance, size, and security review.
29. Expensive or difficult-to-reverse architecture decisions require an ADR.
30. Accepted ADRs are never rewritten to hide history; they are superseded by new ADRs.

## Enforcement

Rules that can be checked automatically must be enforced by CI. Exceptions require an ADR and an explicit code comment or configuration entry that references that ADR.
