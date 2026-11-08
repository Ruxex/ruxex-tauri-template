# Ladle Component Catalog Implementation Plan

**Goal:** Add a lightweight, single-port Ladle catalog for reusable Ruxex components and their representative UI states.

**Architecture:** Ladle discovers colocated `*.stories.tsx` modules under `src`. A global Provider supplies `MemoryRouter` and the existing Ruxex stylesheet. Stories use deterministic props and stay separate from the App Server, DummyProvider, and WDIO flows.

**Tech Stack:** React 19, Vite 7, TypeScript, Ladle 5, Tailwind CSS 4, DaisyUI 5.

**Spec:** `docs/superpowers/specs/2026-11-08-ladle-component-catalog-design.md`

## Constraints

- Keep stories under `src` and name them `*.stories.tsx`.
- Do not connect stories to a real App Server, database, credential store, or network.
- Keep WDIO scenarios responsible for complete pages and volatile backend event states.
- Use the existing `src/styles/index.css` for catalog styling.
- Use one Ladle dev server to browse all component states.

## Implementation

- Replace the React Cosmos dependency/scripts/configuration with `@ladle/react` and `ladle`, `ladle:build`, and `ladle:serve` scripts.
- Add `.ladle/components.tsx` with the shared stylesheet and `MemoryRouter` provider.
- Convert the initial component fixtures to named Ladle stories for common async states, badges, MCP status, chat list items, and server requests.
- Keep Ladle story files outside the production ESLint React-refresh rule.

## Verification

- Run `pnpm typecheck`.
- Run the full Vitest suite.
- Run repository lint and formatting checks.
- Run `pnpm ladle:build` and confirm the generated output is ignored or absent from the working tree.
- Start `pnpm ladle -- --host 0.0.0.0 --port <port>` when LAN preview is needed.
