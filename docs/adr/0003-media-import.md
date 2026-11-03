# ADR-0003 — Media import references source files and isolates FFprobe

- Status: Accepted
- Date: 2026-11-03

## Context

Creator OS must import large local videos, audio files, and images without duplicating multi-gigabyte source files into every project. The editor also needs normalized metadata without coupling domain code or UI code directly to FFmpeg/FFprobe.

## Decision

Creator OS stores media references and normalized metadata in a versioned project-local catalog at `media/index.json`. Source files remain in their original location by default.

Media metadata belongs to `crates/media-core`, which owns Creator OS types such as `MediaAsset`, `MediaKind`, `ProbedMedia`, and `MediaCatalog`.

FFprobe is an infrastructure adapter in the desktop runtime. The UI may request a native file selection dialog and invoke typed Creator OS commands, but it does not read files or execute FFprobe directly.

The development runtime resolves FFprobe from `CREATOR_OS_FFPROBE_PATH` or `PATH`. Bundling/distribution of FFmpeg is a separate future decision because FFmpeg licensing depends on the specific build configuration.

## Consequences

- Importing a 50 GB video does not create another 50 GB copy.
- Moving or deleting an original source file can make a reference unavailable; future relink workflows must handle this explicitly.
- Metadata contracts remain stable even if FFprobe is later replaced or wrapped by another media engine.
- The media catalog is independently versioned and migration-ready.
- Duplicate imports of the same canonical source path return the existing asset instead of creating duplicate catalog entries.
