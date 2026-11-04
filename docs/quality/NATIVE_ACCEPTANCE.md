# Creator OS — Native desktop acceptance checklist (v0.14)

This page is a release gate and **must not be marked complete by browser screenshots alone**.

## Automated Linux validation

[Native desktop workflow](../../.github/workflows/native-desktop.yml) installs Tauri 2 WebKit prerequisites, verifies Totem Cut icons, compiles the release Linux ELF with `tauri build --no-bundle`, and then runs the **actual executable** in a headless X11 display using `xvfb-run`.

The [native startup smoke script](../../scripts/smoke-native-startup.py) isolates HOME/XDG directories, verifies a visible `Creator OS` window with expected minimum geometry, keeps the process alive for a short stability check and saves a screenshot, logs and machine-readable result. CI uploads these as an artifact whether the test passes or fails (if output files were produced). No installer is produced.

**This smoke test only proves startup/window creation on the Linux CI runner.** It does not establish WebView content correctness, media decoding, real user interactions, Windows/macOS support, or an end-user release.

## Real native project E2E (v0.14)

After the startup check, CI installs `webkit2gtk-driver` and the pinned `tauri-driver` 2.0.6 **as runner-only test tools**. The [native project test](../../scripts/test-native-projects.py) uses the *real Tauri release binary* and WebKitGTK WebDriver, not a mocked `window.__TAURI_INTERNALS__`. It creates a project through the UI, confirms actual `project.json` persistence inside a temporary HOME/XDG tree, toggles the theme, reopens the project from Recientes, closes the native app and opens it again to confirm the project UUID survives the restart.

The workflow collects driver logs, per-step screenshots and JSON results even when the test fails. Success is **not assumed** until the workflow has actually passed. Media import dialogs, FFmpeg transcoding, captions and Windows/macOS remain excluded.

## Automated evidence matrix

| Validation | Linux CI | Windows | macOS |
| --- | --- | --- | --- |
| Compile release desktop executable | Workflow required | Not tested | Not tested |
| Launch native executable and detect visible application window | Workflow required (Xvfb) | Not tested | Not tested |
| Native startup screenshot, logs and structured outcome | Workflow required | Not tested | Not tested |
| Native WebDriver: create/reopen project, restart persistence, theme | Workflow required since v0.14 | Not tested | Not tested |

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

The headless smoke command requires Linux `xvfb`, `xdotool`, Openbox, ImageMagick and WebKitGTK/Tauri system libraries. The native E2E test additionally requires `WebKitWebDriver` and `tauri-driver`; after building, use:

```sh
xvfb-run -a -s "-screen 0 1440x900x24" python3 scripts/test-native-projects.py target/release/creator-os-desktop
```

Start a window manager inside the virtual display before running E2E, as done in CI. Neither test substitutes for a manual cross-platform review.

## Budget and compliance

No paid APIs, cloud inference, runtime dependencies, FFmpeg/model bundles or user media are introduced. GitHub Actions runner minutes and artifact storage still have costs. Signing, proprietary codec/redistribution and trademark checks remain separate approvals.

See [ADR-0010](../adr/0010-native-release-gate.md) and [ADR-0014](../adr/0014-native-startup-smoke.md) and [ADR-0015](../adr/0015-native-webdriver-project-e2e.md).
