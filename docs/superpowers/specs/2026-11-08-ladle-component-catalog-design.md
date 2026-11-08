# Ladle Component Catalog

## Intent

Add a lightweight, single-port local component catalog that registers every component file under `src/components` and exposes representative visual and interaction states.

## Goals

- Use Ladle with the existing Vite/React toolchain.
- Define component states as colocated `*.stories.tsx` files, one story module per component source file.
- Provide shared Ruxex CSS and router context to stories.
- Cover representative empty, loading, error, selected, pending, authentication, settings, navigation, composer, conversation, and marketplace states.
- Keep the catalog independent from the DummyProvider database and WDIO page/event scenarios.
- Support one local or LAN-accessible server for browsing all component states.

## Non-goals

- Reproduce complete application routes or App Server behavior.
- Replace WDIO scenarios for backend-backed page states or volatile event flows.
- Add production runtime code solely for the catalog.
- Guarantee that every story exercises a live backend or reproduces every app-level interaction.

## Design

Use `@ladle/react`. Ladle discovers `src/**/*.stories.tsx` files and exposes each named story as a state in one Vite-powered catalog. `.ladle/components.tsx` provides `MemoryRouter` for components that render links. `.ladle/index.css` imports the production stylesheet and explicitly registers `src` as a Tailwind source so utility classes used by stories are emitted.

The catalog has one story module for each TSX component file under `src/components`, excluding tests and existing story modules. A source file exporting multiple components, such as `SettingsCards.tsx`, gets stories for each exported component in that module.

Stories use deterministic props and local test doubles. Components that need router state use `MemoryRouter`; components that need app-server, query, or mutation state receive local providers or no-op callbacks. No story connects to a real App Server, database, credential store, or network.

## State boundary

- Component-level state and prop variants belong in Ladle stories.
- Full-page state, protocol transitions, and volatile approval/event flows remain in WDIO DummyProvider scenarios.
- A story may use local React state for interaction previews, but it must not persist data or call production services.
- Page and layout containers are still registered when they are component source files, but their stories use the smallest deterministic harness needed to render them.

## Registration contract

- Every non-test `src/components/**/*.tsx` file has a colocated `*.stories.tsx` file.
- Every exported React component in a multi-export source file has at least one named Story.
- Story names describe the state being inspected and avoid relying on backend-generated identifiers.
- Shared story helpers live under a catalog-only support module and do not become production dependencies.

## Verification

- `pnpm ladle:build` must generate the static catalog.
- `pnpm typecheck`, `pnpm exec vitest run`, and the repository lint/format checks must pass.
- A repository check must fail when a component source file has no colocated story module.
