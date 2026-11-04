# ADR-0016 — Native FFprobe import and two-codec playback E2E

- Status: Proposed; acceptance requires green CI for Issue #36
- Date: 2026-11-04
- Issue: #36
- Builds on: ADR-0015 and ADR-0004

## Context

Browser visual tests use a mocked Tauri bridge, and native v0.14 tests cover project persistence but not real media decoding. FFprobe, project media catalog persistence, authenticated loopback media gateway and WebKitGTK/GStreamer decoding must be verified together to reduce distribution risk.

## Decision

Run a single additional E2E test in the existing Linux native workflow on the same already-compiled Tauri 2 release ELF. CI generates two short local WebM fixtures (VP8 and VP9, 320x180) using FFmpeg. A stdlib Python WebDriver harness exercises real `import_media`/`list_project_media` Rust commands via the **native Tauri invoke bridge** and the existing WebKitGTK driver, without stubbing `window.__TAURI_INTERNALS__`. To make the CI deterministic, it bypasses only the GTK file-picker interaction: the test submits paths to the typed command with the same Rust validation as the UI. It validates expected FFprobe metadata, typed missing/unreadable probe errors, registered asset IDs, actual native UI media rows, real `video.currentSrc` matching the intended gateway ID, metadata availability and a running WebKit playback clock.

The fixtures, source SHA-256 digests and project storage are isolated under a temporary HOME/XDG directory; the user source files are unchanged and the application project stores references rather than video copies. All jobs produce JSON results and safe screenshots/logs. The opaque gateway token never appears in reports. Install GStreamer codecs only on CI runners, not bundled into Creator OS. No paid APIs, cloud services, model downloads or new application runtime dependencies.

## Limitations

A green test establishes two **specific VP8 and VP9 WebM** playback paths on Linux CI WebKitGTK, not generic codec compatibility, guaranteed gapless montage, FFmpeg export, native file picker behavior, accessibility across devices, Windows/macOS or signed installer readiness. Manual acceptance matrices remain pending. CI runner minutes and artifact storage are real costs.

## Rejected options

- Mocking browser media/FFprobe commands: would not validate the application/infrastructure integration.
- Bundling extra multimedia codecs into the desktop application: requires separate licensing and distribution analysis.
- Testing editor/render/transcription in a single issue: excessively broad and non-diagnostic failures.
