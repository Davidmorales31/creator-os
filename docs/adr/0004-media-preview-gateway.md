# ADR-0004 — Media preview uses a catalog-gated loopback gateway

- Status: Accepted
- Date: 2026-11-03

## Context

Creator OS needs smooth local preview and seeking for large video files while keeping media referenced in place. Loading whole files into the WebView is not viable, copying media into app storage violates the reference-based import decision, and granting a generic asset protocol broad filesystem scope would expose more of the user's disk than the player needs.

## Decision

The desktop shell starts an in-process HTTP media gateway bound only to `127.0.0.1` on an ephemeral port. It is part of the desktop process, not a separately deployed service.

Preview URLs contain only Creator OS `projectId` and `assetId` values plus a random per-process token. The gateway resolves the asset through the project's versioned `media/index.json`; callers never provide a filesystem path to the preview endpoint.

The gateway delegates byte-range and MIME handling to `tower-http`'s file-serving service so HTML media elements can seek without loading an entire source file into memory.

A Tauri command returns a preview URL only after validating the project ID, asset ID, catalog entry, media kind, and source-file availability.

## Security rules

- Bind to loopback only; never `0.0.0.0`.
- Generate a new opaque token for every Creator OS process.
- Never expose a route that accepts a raw filesystem path.
- Only assets present in a Creator OS media catalog may be served.
- Validate project and asset IDs before constructing filesystem paths.
- The preview gateway is read-only.
- Responses are not cached by the gateway.

## Consequences

- Large files can be streamed and seeked without duplication.
- The WebView does not receive broad filesystem permissions.
- The preview mechanism remains an infrastructure detail; domain media contracts do not depend on HTTP/Tauri.
- The desktop app owns one small local-only listener while running.
- Distribution/firewall behavior must be tested on Windows, macOS, and Linux before a stable release.

## Dependencies

`axum`, `tokio`, `tower`, and `tower-http` are used only inside the desktop infrastructure layer. Their licenses and maintenance status must remain acceptable under the Creator OS dependency policy.
