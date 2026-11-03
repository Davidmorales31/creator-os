# ADR-0004 — Media preview uses per-file runtime asset scope

- Status: Accepted
- Date: 2026-11-03

## Context

Creator OS needs to preview user-selected local media inside the Tauri WebView. Imported media can live anywhere on the user's disks, including locations outside standard video or home directories. Granting the WebView broad filesystem access would violate Creator OS's least-privilege architecture.

## Decision

Enable Tauri's asset protocol with an empty static scope. The frontend never requests arbitrary filesystem paths for preview. It sends a project ID and media asset ID to a typed Tauri command. The desktop layer verifies that the asset exists in that project's Creator OS media catalog, verifies the original source is still a regular file, and grants the asset protocol runtime access to that exact canonical file only.

The frontend then uses Tauri `convertFileSrc()` to create the WebView-safe URL. Playback state (play/pause, current time, fit/fill) remains UI-local and is not persisted in the project domain.

## Consequences

- Arbitrary disk-wide asset protocol scopes are not required.
- Restarting Creator OS clears preview grants; selecting an asset authorizes it again.
- Missing source files produce an explicit domain-facing preview error.
- Playback support still depends on codecs supported by the platform WebView. Unsupported codecs remain valid Creator OS assets and can later be served through the planned proxy/transcode pipeline.
- Future proxy media can use the same preview component without changing project or timeline domain models.
