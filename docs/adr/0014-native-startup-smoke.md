# ADR-0014 — Native Linux Tauri release startup smoke in CI

- Status: Accepted (implementation awaiting CI)
- Date: 2026-11-04
- Issue: #32
- Extends: ADR-0010

## Context

The native desktop workflow compiles a valid Linux ELF but does not launch it. Chromium visual-review screenshots exercise a mocked Tauri bridge, so they cannot establish that Tauri's real WebKitGTK-based shell starts successfully.

## Decision

After the existing Linux release ELF check, start the **real release binary** under `xvfb-run` with a short-lived Openbox X11 window manager. A dedicated stdlib-only Python test launches the application with isolated HOME/XDG paths, inspects the X11 window via `xdotool`, requires an exact `Creator OS` title and minimum 960x640 geometry, confirms the app remains alive for at least two seconds, captures the **composited X11 root screen** and crops the application rectangle (direct capture of GTK's toplevel may miss nested WebKit child-window drawing), then rejects blank screenshots by color diversity, and gracefully terminates the app process group. Timeouts, missing window, early crash, and invalid capture fail the job.

CI uploads logs, machine-readable outcome and screenshot as artifacts, including on failure when files exist. Linux runner tools are build/test-only; no new application runtime dependency, framework, service, paid API, pretrained model or user media is introduced. Keep `develop` as the sole active development branch and require all PR checks before merging to `main`.

## Limitations and consequences

The first CI run caught a fully black direct-window screenshot even though the process was alive and the window was 1280×800. Root-screen capture with a window manager is required; retaining the desktop image and window-manager log helps distinguish screenshot issues from WebKit paint issues.

A native window is not a guarantee that the frontend rendered correctly, that controls or local media commands work, or that codec handoffs are smooth. Manual native acceptance on Linux, Windows, and macOS remains **pending**. No installer signing or distribution is authorized. The additional CI step costs runner minutes and artifact storage; it is bounded by a 2-minute step timeout.

## Alternatives considered

- Vite + Chromium only: already covered by visual review, not a native runtime test.
- Full end-to-end UI automation across all OSes immediately: broader and less deterministic; should be a separate milestone after startup evidence.
- Bundling a test browser/decoder in Creator OS: unnecessary distribution size, license and maintenance cost.
