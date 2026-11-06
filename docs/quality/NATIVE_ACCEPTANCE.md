# Creator OS — Native desktop acceptance checklist (v0.19)

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

## Native two-clip timeline montage E2E (v0.16)

The [montage E2E](../../scripts/test-native-montage.py) reuses the same release Tauri executable, stdlib WebDriver client, local FFmpeg VP8 and VP9 fixtures, and Linux WebKitGTK environment already validated in v0.15. It adds two **contiguous clips through real timeline UI controls**, inspects the typed `get_timeline` result and persisted `project.json`, trims the last clip and exercises undo/redo. It starts Montage with the native UI and waits for the video-clock-driven **automatic switch between distinct codec/source assets**, with the second clip actually playing. It also asserts stop/pause does not immediately resume, rejects a generated timeline gap with a clear warning, and checks SHA-256 of both original videos.

Screenshots and a JSON report capture the observed two-clip montage states. The test uses existing application code and adapters — **no new editing engine or external runtime module**. Files are synthetic and temporary.

This is a bounded Linux CI regression, **not** evidence of gapless/frame-perfect transitions, native GTK picker acceptance, multi-track compositing, installed codecs on end-user machines, Windows/macOS support, or signed-distribution readiness.

## Contextual timeline keyboard editing (v0.17)

The existing timeline accepts keyboard shortcuts **only while keyboard focus is inside its section**: `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redo, `S` split the selected clip, and `Delete/Backspace` delete it. Keyboard shortcuts skip editable text inputs/selects/contenteditable, repeated keys, IME composition and unrelated modifier combinations. They are routed to the existing versioned typed `editTimeline` command; media files are never modified.

[Node shortcut tests](../../scripts/test-timeline-shortcuts.mjs) verify mapping and exclusions. The [real native montage E2E](../../scripts/test-native-montage.py) now also delivers W3C WebDriver keyboard actions into the **focused Tauri WebKitGTK** timeline, then checks Rust timeline revisions and undo/redo persistence after each edit. It never fakes DOM `KeyboardEvent` instances. A green run validates this bounded Linux path, not universal keyboard accessibility.

## Real native MP4 export E2E (v0.18)

The [MP4 native export E2E](../../scripts/test-native-export.py) reuses the same **real Tauri release ELF**, Tauri/WebKitGTK WebDriver, existing typed `start_export`/`get_export_status` Rust commands and `export_adapter` FFmpeg backend; no mock, new render engine, runtime dependency, downloaded model or cloud service is used.

CI produces two tiny synthetic VP8/VP9 WebM sources in isolated HOME/XDG storage, creates a project via UI, verifies `empty_timeline` as a typed error, imports both sources through the real native command bridge (the GTK chooser is still out of scope), adds **two contiguous clips by actual UI buttons**, and starts `Exportar MP4` via the actual native UI. It waits for completion and verifies the typed Rust job `completed` at progress 1.0 with the same output path. Independent FFprobe checks H.264, AAC (including silence for video-only inputs), yuv420p, target dimensions/fps and duration bounded to the timeline. SHA-256 of the original files remains unchanged. No partial MP4 may remain, and exactly one MP4 is expected.

The test uploads JSON, logs and native before/after screenshots, not the generated MP4 or source videos. Cancellation, multitrack audio/video, a user-operated GTK file chooser, gapless/frame-perfect edits, signed installers and Windows/macOS acceptance **remain unverified**.

## Native FFmpeg cancellation and recovery regression (v0.19, CI acceptance pending)

The [native cancellation test](../../scripts/test-native-export-cancel.py) reuses the same release Tauri ELF, `test-native-export.py` project/import/timeline helpers, WebKitGTK/tauri-driver, FFmpeg and typed `get_export_status`/`start_export`/`cancel_export` commands. The real UI creates and cancels jobs. The additional `data-export-job-id` is a stable, non-sensitive DOM attribute on the export status element; it is **not** a job-status mock.

A test-only wrapper invokes the **real system FFmpeg binary** with `-re` before inputs, giving the runner a deterministic window for an active render. The script requires a **real FFmpeg PID in Linux /proc** with the unique partial output path, a matching Rust `running` job and native `Renderizando` UI status before clicking `Cancelar`. It also checks `export_busy` for a concurrent start, waits for `cancelled` in Rust and native UI, checks that FFmpeg terminated, no completed or partial MP4 remains, and starts and cancels another export to prove the lock was released. SHA-256 of source files and original import catalog are checked. Synthetic sources, exported files and wrapper are created only under temporary HOME/XDG storage; artifacts contain JSON/logs/screenshots, **never media files**.

A green Linux CI run validates this bounded cancellation path only. It does **not** prove cancellation across all codecs, worker starvation, app crashes, Windows/macOS, signed installers, multitrack exports or gapless rendering. Manual OS acceptance remains pending.

## Automated evidence matrix

| Validation | Linux CI | Windows | macOS |
| --- | --- | --- | --- |
| Compile release desktop executable | Workflow required | Not tested | Not tested |
| Launch native executable and detect visible application window | Workflow required (Xvfb) | Not tested | Not tested |
| Native startup screenshot, logs and structured outcome | Workflow required | Not tested | Not tested |
| Native WebDriver: create/reopen project, restart persistence, theme | Workflow required since v0.14 | Not tested | Not tested |
| Native FFprobe/bridge: real VP8/VP9 import, metadata, preview/playback, SHA-256 | Workflow required since v0.15 | Not tested | Not tested |
| Native WebKit montage: UI two clips, trim/undo/redo, VP8→VP9 handoff, stop and gap error | Workflow required since v0.16 | Not tested | Not tested |
| Timeline keyboard shortcuts with native W3C key actions and persisted Rust undo/redo | Workflow required since v0.17 | Not tested | Not tested |
| Native FFmpeg/FFprobe MP4 output: VP8+VP9 to H.264/AAC, dimensions/FPS/duration, SHA-256 | Workflow required since v0.18 | Not tested | Not tested |
| Native in-progress FFmpeg cancellation, export_busy, process/partial cleanup and recovery | Workflow required since v0.19 | Not tested | Not tested |

Results are **required checks**, not marked passed until a given workflow run succeeds.

## Manual smoke-test matrix

| User workflow | Linux | Windows | macOS |
| --- | --- | --- | --- |
| Open native Tauri window; confirm Totem Cut/logo and light/dark contrast | Pending | Pending | Pending |
| Create/open/reopen project, verify `project.json` migration and recent list | Pending | Pending | Pending |
| Import sample video/audio, inspect FFprobe metadata and preview playback/seek | Pending | Pending | Pending |
| Add/split/move/trim/delete timeline clips; undo/redo survives reopen | Pending | Pending | Pending |
| Keyboard shortcuts in focused timeline, including input/IME exclusion and screen-reader behavior | Pending | Pending | Pending |
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
xvfb-run -a -s "-screen 0 1440x900x24" python3 scripts/test-native-montage.py target/release/creator-os-desktop
xvfb-run -a -s "-screen 0 1440x900x24" python3 scripts/test-native-export.py target/release/creator-os-desktop
xvfb-run -a -s "-screen 0 1440x900x24" python3 scripts/test-native-export-cancel.py target/release/creator-os-desktop
```

Start a window manager inside the virtual display before running E2E, as done in CI. Neither test substitutes for a manual cross-platform review.

## Budget and compliance

No paid APIs, cloud inference, runtime dependencies, FFmpeg/model bundles or user media are introduced. GitHub Actions runner minutes and artifact storage still have costs. Signing, proprietary codec/redistribution and trademark checks remain separate approvals.

See [ADR-0010](../adr/0010-native-release-gate.md), [ADR-0014](../adr/0014-native-startup-smoke.md), [ADR-0015](../adr/0015-native-webdriver-project-e2e.md), [ADR-0016](../adr/0016-native-media-e2e.md) [ADR-0017](../adr/0017-native-montage-e2e.md) and [ADR-0018](../adr/0018-native-mp4-export-e2e.md) and [ADR-0019](../adr/0019-native-ffmpeg-cancel-e2e.md).
