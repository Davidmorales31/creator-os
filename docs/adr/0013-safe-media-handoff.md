# ADR-0013 — Media-element handoff is seek-confirmed and generation-scoped

- Status: Accepted
- Date: 2026-11-03
- Issue: #30
- Supersedes: no previous ADR; refines ADR-0012

## Context

Sequential montage playback was implemented over one HTML video element and an app-owned montage session. Source switching introduces asynchronous work: the local media gateway returns a URL, the WebView loads metadata, seeking completes asynchronously, and media events from the old source may be delivered after a new segment has been selected.

Accepting `timeupdate` or `ended` while seeking, or an obsolete event after changing sources, can accidentally advance multiple clips, skip trimmed content, or play the wrong source.

## Decision

A small pure TypeScript contract (`montage-handoff.ts`) models each segment activation as `seeking → playing → finished`, keyed by the existing run UUID and segment index. It validates completion against the real media clock and half-open source clip interval. The player only begins playback once metadata is ready and the source seek is confirmed within half a project frame (the bound accounts for WebView frame-time quantization). An `ended` signal during seek is ignored.

The media player owns **one** media DOM element at a time, keyed by project, registered asset and media URL; obsolete element event callbacks must satisfy identity checks against `videoRef.current`. URL state retains its originating asset ID so an old URL is not rendered under a newly selected asset while an async request resolves. Media transitions and errors are ignored when their run/segment key is no longer current. A failed `play()` for an active segment reports a clear error and stops the montage.

Do not keep a second decoder or preload an entire video; the existing authenticated local gateway is reused. All timeline/source planning remains independent of Tauri, FFmpeg and React.

## Verified behavior and limitations

- Deterministic unit tests cover stale keys, seeking/playing/finished phases, clip boundaries and half-frame seek tolerance.
- Browser visual integration uses two locally encoded VP8/VP9 WebM fixtures, invokes real media loading, verifies handoff changes `currentSrc` and media is playing, injects an obsolete node event and verifies the current segment does not advance.
- Browser tests stub native Tauri calls only; the video decoding happens in actual Chromium.
- This does **not** establish glitch-free, frame-perfect hard cuts across codecs or platform-specific WebView support. Browser autoplay and native multimedia may differ; manual native testing on Linux, Windows and macOS remains required before release.
- Source files are not modified or copied. No new provider, cloud service, AI model or paid API. Extra test codec encode time consumes CI CPU; CI retention limits still apply.

See `CONSTITUTION.md` and ADR-0012.
