# Creator OS — Native desktop acceptance checklist (v0.9)

This page is a release gate and **must not be marked complete by browser screenshots alone**.

## Automated Linux build

[Native desktop workflow](../../.github/workflows/native-desktop.yml) runs on PRs affecting desktop/native code and can run manually. It installs Tauri 2 WebKit prerequisites, checks actual Totem Cut app icons, installs pinned pnpm dependencies, builds the **release Tauri executable** with `tauri build --no-bundle`, then checks that the executable exists and is a Linux ELF. No installer is produced, uploaded, or falsely advertised.

## Manual smoke-test matrix

| User workflow | Linux | Windows | macOS |
| --- | --- | --- | --- |
| Open native Tauri window; confirm Totem Cut/logo and light/dark contrast | Pending | Pending | Pending |
| Create/open/reopen project, verify `project.json` migration and recent list | Pending | Pending | Pending |
| Import sample video/audio, inspect FFprobe metadata and preview playback/seek | Pending | Pending | Pending |
| Add/split/move/trim/delete timeline clips; undo/redo survives reopen | Pending | Pending | Pending |
| Export contiguous video clips into MP4 and play result in system player | Pending | Pending | Pending |
| Cancel an active render and inspect `.partial.mp4` cleanup | Pending | Pending | Pending |
| Missing FFmpeg/Python gives explanatory, non-crashing errors | Pending | Pending | Pending |
| Consent-based local transcription with downloaded/cached model | Pending | Pending | Pending |
| SRT/VTT sidecar files open with matching text and timestamp formatting | Pending | Pending | Pending |
| Activate CC overlay; seek across caption boundaries, switch assets/revisions | Pending | Pending | Pending |
| Close app during jobs; verify cleanup/restart and no zombie worker processes | Pending | Pending | Pending |

Do not promote these cells to PASS without actual executed evidence on a native platform. A Linux build in CI does **not** establish Windows/macOS support or native GUI interaction.

## Local developer commands

Install FFmpeg + FFprobe and optional Python worker only when needed. Follow the [official Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) on your OS.

```sh
pnpm install
python3 scripts/check-native-assets.py
pnpm --dir apps/desktop exec tauri build --no-bundle
pnpm --dir apps/desktop exec tauri dev
```

Sample media can be synthesized locally with FFmpeg; never upload a real user's source media to CI. The transcription test requires a user-authorized model download once, then checks cached/offline behavior separately.

## Budget and compliance

This issue adds no paid API, cloud inference or new runtime dependency. GitHub Actions minutes and runner storage are real costs; the build job has a 45-minute timeout and Rust cache. No FFmpeg/model binaries are bundled. Signing, proprietary codec/redistribution and trademark checks are separate approvals.

See `docs/adr/0010-native-release-gate.md`.
