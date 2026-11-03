# v0.12 — Reproducción multifuente más segura

Issue #30 adds a deterministic lifecycle to montage playback. Creator OS waits for actual metadata and seeks to the source in-point before starting a segment. Video DOM events from an obsolete source or from an earlier montage run cannot advance the current playback.

## Test coverage

```sh
node --experimental-strip-types scripts/test-montage-handoff.mjs
node --experimental-strip-types scripts/test-montage-plan.mjs
pnpm typecheck
```

Chromium visual review creates two different real local WebM videos (VP8 and VP9), uses a mocked Tauri catalog and real decoding, checks the next source URL becomes active, injects a stale `ended` event, stops playback and verifies the media element is paused. Screenshots remain available as CI artifacts.

Native Tauri on Linux, macOS and Windows **must still be tested manually**, especially mixed-codec clips, slow HDD/network storage, unsupported codecs and stopping at a clip boundary. No promise of zero-frame black gaps: that requires proxy/composition work and a separate performance study.

Budget: $0 cloud/API, single HTML video element, no extra decoder, no model downloads. Source files remain unchanged.
