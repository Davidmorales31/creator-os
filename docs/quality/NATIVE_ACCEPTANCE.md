# Creator OS — Native desktop acceptance checklist (v0.15)

This page is a release gate and **must not be marked complete by browser screenshots alone**.

## Automated Linux validation

[Native desktop workflow](../../.github/workflows/native-desktop.yml) installs Tauri 2 WebKit prerequisites, verifies Totem Cut icons, compiles the release Linux ELF with `tauri build --no-bundle`, and then runs the **actual executable** in a headless X11 display using `xvfb-run`.

The [native startup smoke script](../../scripts/smoke-native-startup.py) isolates HOME/XDG directories, verifies a visible `Creator OS` window with expected minimum geometry, keeps the process alive for a short stability check and saves a screenshot, logs and machine-readable result. CI uploads these as an artifact whether the test passes or fails (if output files were produced). No installer is produced.

**This smoke test only proves startup/window creation on the Linux CI runner.** It does not establish WebView content correctness, media decoding, real user interactions, Windows/macOS support, or an end-user release.

## Real native project E2E (v0.14)

After the startup check, CI installs `webkit2gtk-driver` and the pinned `tauri-driver` 2.0.6 **as runner-only test tools**. The [native project test](../../scripts/test-native-projects.py) uses the *real Tauri release binary* and WebKitGTK WebDriver, not a mocked `window.__TAURI_INTERNALS__`. It creates a project through the UI, confirms actual `project.json` persistence inside a temporary HOME/XDG tree, toggles the theme, reopens the project from Recientes, closes the native app and opens it again to confirm the project UUID survives the restart.

The workflow collects driver logs, per-step screenshots and JSON results even when the test fails. Success is **not assumed** until the workflow has actually passed. Media import dialogs, FFmpeg transcoding, captions and Windows/macOS remain excluded.

## Real native media import and playback E2E (v0.15)

The [media E2E script](../../scripts/test-native-media.py) runs against the **real Tauri release executable** using the same WebKitGTK/tauri-driver stack as v0.14. Local FFmpeg creates a small eight-second VP8 WebM and a separate VP9 WebM in an isolated temporary directory. The test invokes `import_media` and `list_project_media` through the **genuine Tauri command bridge** in the app WebView (no mocked commands), verifies FFprobe metadata and the persisted media index, and checks that selecting each imported video in the native UI produces metadata and an advancing playback clock from the correct gateway asset ID.

The test checks typed `ffprobe_unavailable` (missing executable) and `media_probe_failed` (invalid fixture), verifies SHA-256 of both originals before/after, and proves the project media directory contains only its catalog index. It captures native VP8 light-theme and VP9 dark-theme screenshots plus runner logs and a JSON result. The fixture media and HOME/XDG project files are temporary and are not committed or included in artifacts.

**Explicitly untested:** the GTK file picker (assets are imported through the typed native command from the test WebView), export, multi-clip montage, subtitle rendering, Python models, Windows/macOS and human release acceptance. This automated scope cannot be generalized to other codecs or operating systems.

## Automated evidence matrix

| Validation | Linux CI | Windows | macOS |
| --- | --- | --- | --- |
| Compile release desktop executable | Workflow required | Not tested | Not tested |
| Launch native executable and detect visible application window | Workflow required (Xvfb) | Not tested | Not tested |
| Native startup screenshot, logs and structured outcome | Workflow required | Not tested | Not tested |
| Native WebDriver: create/reopen project, restart persistence, theme | Workflow required since v0.14 | Not tested | Not tested |
| Native FFprobe/bridge: real VP8/VP9 import, metadata, preview/playback, SHA-256 | Workflow required since v0.15 | Not tested | Not tested |

Results are **required checks**, not marked passed until a given workflow run succeeds.

## Manual smoke-test matrix

| User workflow | Linux | Windows | macOS |
| --- | --- | --- | --- |
| Open native Tauri window; confirm Totem Cut/logo and light/dark contrast | Pending | Pending | Pending |
| Create/open/reopen project, verify `project.json` migration and recent list | Pending | Pending | Pending |
| Import sample video/audio, inspect FFprobe metadata and preview playback/seek | Pending | Pending | Pending |
| Add/split/move/trim/delete timeline clips; undo/redo survives reopen | Pending | Pending | Pending |
| Sequential montage playback across two media codecs, seek and stop | Pending | Pending | Pending |
| Export contiguous video clips into MP4 and play result in system player | Pending | Pending | Pending |
| Cancel an active render and inspect `.partial.mp4` cleanup | Pending | Pending | Pending |
| Missing FFmpeg/Python gives explanatory, non-crashing errors | Pending | Pending | Pending |
| Consent-based local transcription with downloaded/cached model | Pending | Pending | Pending |
| SRT/VTT sidecar files open with matching text and timestamp formatting | Pending | Pending | Pending |
| Activate CC overlay; seek across caption boundaries, switch assets/revisions | Pending | Pending | Pending |
| Close app during jobs; verify cleanup/restart and no zombie worker processes | Pending | Pending | Pending |

Do not promote any manual cells to PASS without actual executed evidence on that native OS.

## Developer commands

Install FFmpeg + FFprobe and optional Python worker only when needed. Follow the [official Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) on your OS.

```sh
pnpm install
python3 scripts/check-native-assets.py
pnpm --dir apps/desktop exec tauri build --no-bundle
xvfb-run -a -s "-screen 0 1440x900x24" python3 scripts/smoke-native-startup.py target/release/creator-os-desktop
pnpm --dir apps/desktop exec tauri dev
```

The headless smoke command requires Linux `xvfb`, `xdotool`, Openbox, ImageMagick and WebKitGTK/Tauri system libraries. The native E2E tests additionally require `WebKitWebDriver`, `tauri-driver` and GStreamer VP8/VP9 decoders; after building, use:

```sh
xvfb-run -a -s "-screen 0 1440x900x24" python3 scripts/test-native-projects.py target/release/creator-os-desktop
xvfb-run -a -s "-screen 0 1440x900x24" python3 scripts/test-native-media.py target/release/creator-os-desktop
```

Start a window manager inside the virtual display before running E2E, as done in CI. Neither test substitutes for a manual cross-platform review.

## Budget and compliance

No paid APIs, cloud inference, runtime dependencies, FFmpeg/model bundles or user media are introduced. GitHub Actions runner minutes and artifact storage still have costs. Signing, proprietary codec/redistribution and trademark checks remain separate approvals.

See [ADR-0010](../adr/0010-native-release-gate.md), [ADR-0014](../adr/0014-native-startup-smoke.md), [ADR-0015](../adr/0015-native-webdriver-project-e2e.md) and [ADR-0016](../adr/0016-native-media-e2e.md).
