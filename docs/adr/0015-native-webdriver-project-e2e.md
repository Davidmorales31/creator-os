# ADR-0015 — Real Tauri project E2E through Linux WebKit WebDriver

- Status: Proposed; CI validation required before acceptance
- Date: 2026-11-04
- Issue: #34
- Depends on: #32 / ADR-0014

## Context

The Linux native startup smoke proves a real Tauri WebKitGTK window renders in Xvfb, but it does not validate the React → typed Rust command boundary or project filesystem persistence. Browser Chromium screenshots use a mocked Tauri bridge, making native regression detection incomplete.

## Decision

Add a small **CI-only**, stdlib Python W3C WebDriver client that starts the pinned upstream `tauri-driver` 2.0.6 and Ubuntu's `WebKitWebDriver` under Xvfb/Openbox. The client drives **the exact release executable** already compiled by the native CI job, not a Vite server or test mock. It enters a real project name through the UI, triggers `create_project`, inspects the resulting `project.json` under isolated XDG data directories, navigates to Recientes, invokes `open_project`, toggles light/dark UI, closes its driver session, relaunches Tauri, and confirms the same UUID persists.

The test limits scope to *actual native project/UI integration* and saves screenshots, WebDriver stdout/stderr and a JSON outcome. It is required on PRs affecting native code. No new project-runtime dependencies, media model weights, remote APIs, cloud upload or model-download paths are introduced. The runner consumes extra GitHub Actions CPU time, especially the pinned CLI installation; licenses and tooling are reviewed as test-only dependencies, and no driver binaries are distributed.

## Limits and release gate

Green WebDriver E2E only establishes the exercised Linux project and theme path, **not** media import/decoding, FFmpeg export, transcriptions, subtitle rendering, other platforms, installer signing or manual acceptance. The existing manual matrix remains pending until real human testing. Failures must block PR merge; technical limitations are recorded explicitly rather than bypassing assertions or introducing Tauri mocks.

## Alternatives

- Chromium mock suite alone: misses native commands and filesystem.
- Pixel-coordinate automation: fragile under scaling and language changes.
- Add Node Selenium/WebdriverIO runtime libraries to Creator OS: unnecessary for a small fixed CI test; revisit if the suite grows.
- Full editor + media end-to-end coverage in one PR: too broad; split by user workflow.
