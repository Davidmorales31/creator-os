# Creator OS Design System

Creator OS follows a macOS-native feel without copying proprietary Apple assets or reproducing Apple applications pixel-for-pixel.

## Principles

- Content over chrome.
- Clear hierarchy and one obvious primary action per context.
- Sidebar for global navigation, toolbar for contextual actions, inspector for properties.
- Light and dark themes are first-class.
- 8pt spacing grid.
- All visual constants come from shared design tokens.
- Keyboard-first for frequent actions.
- Every interactive state includes focus, hover, pressed, disabled, loading, error, and offline behavior where applicable.

## Token authority

Shared tokens live in `packages/ui/src/tokens.css`. Product screens must consume those tokens rather than inventing local colors, radii, shadows, or spacing values.

## Visual direction

The product should feel calm, dense enough for professional work, and creator-focused. Video, scripts, timelines, and media should dominate the interface; decorative chrome should remain secondary.

## Review rule

Any new repeated UI pattern must become a reusable component before it proliferates across multiple screens.

## Approved mockup specification — light desktop

The approved visual reference is the **four-screen, light-mode Creator OS mockup** supplied in the project conversation. It contains Home, Script Studio, Editor, and Publish. The dark variant uses the same layout and separate semantic tokens.

### Shell and composition

- One continuous macOS-inspired desktop shell: narrow left navigation rail, contextual top toolbar, content canvas.
- Light backgrounds are almost-white neutral surfaces. Selected navigation uses soft violet, while the primary CTA uses saturated violet. Accent must not be applied indiscriminately.
- Toolbar: breadcrumb/title, meaningful search affordance, contextual primary action; do not create fake close/minimize controls.
- Sidebar displays Inicio, Proyectos, Script Studio, Voice Studio, Biblioteca, Editor, Shorts, Miniaturas, Publicar, Analíticas and settings when implemented. Features not built must be clearly identified as coming soon.
- Home: welcome/title, five compact action tiles, recent project cards, narrow right activity/system status rail.
- Editor: compact editing actions, project media left, dominant 16:9 preview center, contextual properties inspector right, wide timeline below. Until the timeline is functional it is explicitly marked as a preview of the next issue.
- Script Studio: reference assets and narrative/style library left, main script writing surface center, style/pacing inspector right.
- Publish: content summary left, providers and publishing details center, scheduling/status rail right. Controls appear enabled only when backing integrations exist.

### Non-negotiable implementation rules

1. Shared semantic tokens in `packages/ui/src/tokens.css` are authoritative. No one-off colors, borders, radii, spacing or shadows inside feature components.
2. Prefer 8px increments and compact controls; make media/script/timeline the visual focus.
3. No visual action without an actual handler. Unimplemented features display **Próximamente** or are inert explanatory placeholders, never enabled deceptive buttons.
4. Every clickable element has focus, hover, disabled and error states when applicable. Keyboard actions remain accessible. Respect reduced-motion.
5. Screen structure must adapt to narrow windows without covering primary media controls.
6. Final approval requires a **side-by-side screenshot comparison against the supplied mockup** on an actual desktop run at the same viewport size, plus light/dark and accessibility checks. CI build success alone does not certify pixel-perfect parity.

### Implemented in design PR

The home shell/shortcuts/activity rail and editor media-preview-inspector/timeline layout are implemented as a light-first style foundation. Narrative generation, voice cloning, timeline manipulation, and publishing are not presented as working features. Exact screenshot-level parity remains a visual review gate.
