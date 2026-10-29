# Plugin Marketplace Design

## Intent

Expose the marketplace and plugin metadata already available through the Ruxex App Server, and let users manage additional Git or local marketplaces from Settings.

## Goals

- Show marketplace display names and plugin metadata in the existing Plugins page.
- Show installation and enablement state, and install available local-backed plugins.
- Refresh configured Git marketplaces through the existing App Server command.
- Add, upgrade, and remove marketplaces from a dedicated Settings section.

## Non-goals

- Scrape the ChatGPT/Codex web UI or depend on undocumented public catalog endpoints.
- Read or mutate the host Codex installation's `~/.codex` cache.
- Add a new marketplace transport; use the existing App Server protocol.

## Constraints

- The desktop App Server owns marketplace discovery and persistence under the Ruxex desktop home.
- `plugin/install`, `plugin/read`, and `marketplace/remove` can fail and must surface server errors.
- Remote-only marketplace entries without a local path are displayable but cannot be installed through the current install protocol.

## Approaches

1. Direct HTTP catalog integration: rejected because the official public directory does not expose a documented client API and would couple the desktop to an unstable endpoint.
2. Read Codex's host cache: rejected because the desktop intentionally isolates `RUXEX_HOME` and the cache is implementation-specific.
3. App Server marketplace integration: selected because the protocol already provides listing, search, install, add, remove, and upgrade operations and applies the backend's policy checks.

## UI shape

- `/capabilities` remains the browse/install surface.
- `/settings/marketplaces` becomes the source-management surface.
- Marketplace mutations invalidate the plugin list so both surfaces converge without a restart.
