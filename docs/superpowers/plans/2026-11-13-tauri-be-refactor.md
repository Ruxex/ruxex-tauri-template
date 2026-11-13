# Tauri BE Refactor Plan

**Goal:** Reduce the size and responsibility overlap of the Tauri Rust backend without changing its CLI, IPC, or serialized output contracts.

**Architecture:** Keep `lib.rs` as the composition root and preserve existing public facades. Separate artifact format operations and share OOXML extraction, move Marketplace asset work out of desktop setup, and isolate App Server connection establishment from command handling.

**Approaches:** Keep the large modules and only add comments; split each concern into focused modules; or extract broad backend layers into new crates. Use focused modules because the repo already has these boundaries and new crates add unnecessary API surface.

**Constraints:** Preserve Tauri command names and payloads, artifact CLI/engine JSON, existing error mapping, and the repository's Rust formatting/toolchain conventions. Do not add dependencies or change runtime behavior.

## Steps

1. Split `artifacts.rs` into a facade, CLI/engine entry points, and format modules while preserving shared error and JSON helpers.
2. Consolidate OOXML block and text extraction in `ooxml.rs`; use it from artifacts and previews.
3. Move Marketplace asset commands and validation into `marketplace_assets.rs`.
4. Move App Server connection establishment into `app_server/connection.rs`; keep Tauri commands in `app_server.rs`.
5. Inspect the final diff and run formatting and whitespace checks. Tests are not run as part of this request.
