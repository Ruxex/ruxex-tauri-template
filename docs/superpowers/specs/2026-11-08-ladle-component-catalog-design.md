# Ladle Component Catalog

## Intent

Add a lightweight, single-port local component catalog for inspecting reusable Ruxex UI components in explicit visual and interaction states.

## Goals

- Use Ladle with the existing Vite/React toolchain.
- Define component states as colocated `*.stories.tsx` files.
- Provide shared Ruxex CSS and router context to stories.
- Cover representative empty, loading, error, selected, pending, and authentication states.
- Keep the catalog independent from the DummyProvider database and WDIO page/event scenarios.
- Support one local or LAN-accessible server for browsing all component states.

## Non-goals

- Reproduce complete application routes or App Server behavior.
- Replace WDIO scenarios for backend-backed page states or volatile event flows.
- Add production runtime code solely for the catalog.

## Design

Use `@ladle/react`. Ladle discovers `src/**/*.stories.tsx` files and exposes each named story as a state in one Vite-powered catalog. `.ladle/components.tsx` provides `MemoryRouter` for components that render links and imports the existing global stylesheet.

Initial stories cover `AsyncState`, `StateBadge`, `McpStatusSummary`, `ChatListItem`, and `ServerRequestCard`. They use deterministic props and no real App Server, database, credentials, or network requests.

## State boundary

- Component-level state and prop variants belong in Ladle stories.
- Full-page state, protocol transitions, and volatile approval/event flows remain in WDIO DummyProvider scenarios.
- A story may use local React state for interaction previews, but it must not persist data or call production services.

## Verification

- `pnpm ladle:build` must generate the static catalog.
- `pnpm typecheck`, `pnpm exec vitest run`, and the repository lint/format checks must pass.
