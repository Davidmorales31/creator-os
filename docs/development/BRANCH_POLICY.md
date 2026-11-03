# Creator OS — Development branch policy

The project uses **two permanent branches** and no stacked issue branches:

- `main`: integrated code that passed CI and visual review.
- `develop`: the **only active development branch**, synced with `main` after each merge.

## Workflow

1. Define a GitHub issue with scope, acceptance tests, cost impacts and Constitution/ADR constraints.
2. Commit related changes **directly to `develop`**. Keep unrelated work out of the PR.
3. Open one PR `develop → main`; do not open stacked PRs or create `feat/*` branches.
4. Require green CI, screenshot review and — for native-impacting changes — native desktop Linux build.
5. Merge using **merge commit**, preserving ancestry. Verify `main` then fast-forward `develop` to the merge commit.
6. Close the issue only once its tests are green and required native manual gates are met. Incomplete manual checks stay explicitly documented.

**Legacy branches** from v0.1–v0.8 remain historical references, not active development branches. All their code was integrated through [PR #23](https://github.com/Davidmorales31/creator-os/pull/23) at commit `74b4fde30fc238c09d0522ca9bf31ea447e24259`.

## Release gates

A PR with green tests is not necessarily a signed/releasable app. Linux CI compiles a native Tauri executable; Windows/macOS native user-flow tests and signed installers are separate release approvals. Never claim successful native functionality just because Vite screenshots pass.

No secrets, model weights, FFmpeg binaries or personal media are committed. Remote APIs are optional, and local-first remains the default. See `CONSTITUTION.md`.
