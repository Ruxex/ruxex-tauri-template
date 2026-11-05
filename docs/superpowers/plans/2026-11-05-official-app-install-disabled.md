# OpenAI App Install Disabled Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent installation of OpenAI Apps while showing a disabled button with an explanatory hover title, keep plugin cards stable for long descriptions, and place marketplace controls in Details.

**Architecture:** Parse each plugin's `apps` declaration in the backend and expose it through the existing `PluginSummary.installPolicySource` marker. The Plugins page uses that per-plugin marker, not marketplace names. Render card contents as a fixed three-column grid with a shrinkable text column and a reserved action column. Put reload and settings controls at the top of Details.

**Tech Stack:** React 19, TypeScript, Tailwind/DaisyUI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-05-official-app-install-disabled-design.md`

## Global Constraints

- `openai-curated` is not itself an Apps marker.
- The existing protocol marker is `installPolicySource: "IMPLICIT_CANONICAL_APP"`.
- Canonical-App entries remain visible but must not call `plugin/install`.
- The unsupported explanation is exposed through the install button's hover title.
- Uninstalled entries do not show the `Available` badge.
- Plugin cards keep image, text, and action area in left-to-right order when descriptions wrap.
- No App Server protocol or generated type changes are needed.

## Review Focus

- Official marketplace with a local path: button is disabled and cannot install; covered by the official marketplace page test.
- Non-official local marketplace: install still calls `mutateAsync` with its marketplace path and plugin name; covered by the local install test.
- Remote-only marketplace: no install button and existing explanatory text remain; covered by the existing page test.
- Installed official plugin: no install button is rendered; covered by the official marketplace page test fixture/assertion.

### Task 1: Propagate OpenAI App metadata through the backend

Parse `apps` in the plugin manifest, detect it for local marketplace plugins,
and set the existing `PluginInstallPolicySource::ImplicitCanonicalApp` value.

### Task 2: Disable canonical-App installation in the Plugins page

**Files:**
- Modify: `src/pages/CapabilitiesPage.tsx` (marketplace plugin action rendering)
- Test: `src/pages/CapabilitiesPage.test.tsx`

**Interfaces:**
- Consumes: `plugin.installPolicySource`, `marketplace.path`, `plugin.installed`, and the existing `useInstallPlugin` mutation.
- Produces: an official-marketplace install button with `disabled={true}` and `title="Official Apps are not supported in Ruxex."`; no mutation call from that button.

- [ ] **Step 1: Add the failing test**

  Extend the Plugins page test data/assertions so an uninstalled plugin with `IMPLICIT_CANONICAL_APP` metadata must expose an install button with the exact unsupported title, be disabled, and leave `installPlugin.mutateAsync` untouched when clicked. Assert that an ordinary plugin in the same marketplace remains enabled, `Available` is absent, and the plugin content wrapper uses the three-column grid classes. Assert that reload is in Details and the gear links to marketplace settings.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run: `pnpm vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: FAIL because the current implementation renders an enabled install button for `official` entries and invokes the install mutation.

- [ ] **Step 3: Implement the marketplace predicate and rendering rule**

  In `src/pages/CapabilitiesPage.tsx`, derive the canonical-App state from `plugin.installPolicySource`. Canonical entries must render the same square install affordance but with the disabled state and exact unsupported title, while ordinary local entries retain the current install handler and remote-only entries retain their current message/no-button behavior. Keep installed entries without an install button. Remove the `Available` status badge for uninstalled entries. Replace the plugin content flex wrapper with a three-column grid (`auto`, shrinkable text, `auto`) and keep the action column reserved so long descriptions wrap only in the text column. Keep reload and the settings `NavLink` at the top of Details.

- [ ] **Step 4: Run the focused test and verify it passes**

  Run: `pnpm vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Run project verification**

  Run: `pnpm typecheck && pnpm lint:biome && pnpm lint:react`

  Expected: all commands exit successfully with no new diagnostics.
