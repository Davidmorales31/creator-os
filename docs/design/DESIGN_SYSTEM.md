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
