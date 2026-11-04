# Tauri branding centralization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `src-tauri/src/branding.rs` the typed runtime branding source and expose its user-facing values to React through a Tauri command.

**Architecture:** Rust owns one typed `Branding` value composed with the provider runtime factory in `DesktopConfig`. Tauri returns a serializable view of the injected value through `get_branding`; React loads it once into `BrandingProvider` and passes the assistant name into UI presentation code. Static Tauri bundle metadata remains in `tauri.conf.json` as packaging configuration.

**Tech Stack:** Rust 2024, Tauri 2, Serde, React 19, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-tauri-branding-design.md`

## Global Constraints

- Keep the template's default user-facing identity as Ruxex.
- Preserve internal Ruxex protocol names, runtime package paths, storage keys, and generated types.
- Do not replace dynamic server/provider/project names with the application brand.
- Use the repository Makefile for verification; preserve unrelated working-tree changes.

## Review Focus

- Native command availability: React should only request branding in the native Tauri runtime and remain usable in browser/mock tests.
- Branding load latency: UI must render a neutral fallback before the asynchronous command resolves, then update to the configured assistant name.
- Conversation model purity: pure normalization helpers must remain usable in tests without a React context while accepting a configured assistant name from the workspace.
- Product identity stability: `ProductIdentity` must continue using the configured slug, home directory, and marker file values.
- Packaging compatibility: the static bundle identifier and `ruxex` deep-link scheme must remain unchanged and outside the runtime branding DTO.
- Internal-name boundaries: protocol fields, local-storage keys, and runtime package paths must not be renamed as part of the user-facing branding change.

### Task 1: Add the canonical Rust branding configuration

**Files:**
- Create: `src-tauri/src/branding.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/desktop.rs`
- Test: `src-tauri/src/branding.rs` (inline Rust tests)

**Interfaces:**
- Produces public `Branding` and `DesktopConfig` types with Ruxex defaults.
- Produces `pub(crate) fn product_identity() -> ruxex::ProductIdentity` or an equivalent helper consumed by `desktop.rs`.
- Produces `#[tauri::command] pub(crate) fn get_branding() -> Branding` for the frontend.

- [ ] **Step 1: Write failing Rust tests** for the canonical Ruxex display values, product slug, home directory, marker file, and serialized UI view; keep the static deep-link scheme and bundle identifier covered by Tauri configuration tests.
- [ ] **Step 2: Run `make rust-test`** and verify the new tests fail because the branding module and command do not exist.
- [ ] **Step 3: Implement the typed `Branding` struct and `DesktopConfig` composition root** in `src-tauri/src/branding.rs` and `src-tauri/src/desktop_config.rs`; keep runtime product identity fields in the same value while serializing only UI-facing fields. Leave the static bundle identifier and compatibility deep-link scheme in Tauri/platform configuration.
- [ ] **Step 4: Register `branding` in `lib.rs`** and add `get_branding` to the Tauri invoke handler.
- [ ] **Step 5: Make `DesktopConfig` supply `ProductIdentity`, provider factory, and the `~/home_dir_name` path** and set the native window title from the injected branding during Tauri setup.
- [ ] **Step 6: Run `make rust-test`** and verify the branding and existing Rust tests pass.

### Task 2: Add the typed React bridge and provider

**Files:**
- Create: `src/platform/branding.ts`
- Create: `src/platform/branding.test.ts`
- Create: `src/app/branding.tsx`
- Create: `src/app/branding.test.tsx`
- Modify: `src/app/providers.tsx`
- Modify: `src/app/providers.test.tsx`

**Interfaces:**
- `getBranding(): Promise<Branding>` invokes `get_branding`.
- `BrandingProvider` loads branding only when `isNativeDesktopRuntime` is true.
- `useBranding(): Branding | null` returns the loaded value or `null` while unavailable.

- [ ] **Step 1: Write failing bridge and provider tests** asserting the exact Tauri command, native-runtime gating, and resolved context value.
- [ ] **Step 2: Run the focused Vitest files** and verify they fail because the bridge/provider do not exist.
- [ ] **Step 3: Implement the typed bridge and `BrandingProvider`** with a neutral loading state and no browser-time invoke call.
- [ ] **Step 4: Wrap the application runtime with `BrandingProvider`** and update provider tests for the additional context layer.
- [ ] **Step 5: Run the focused Vitest files** and verify they pass.

### Task 3: Route user-facing assistant labels through the provider

**Files:**
- Modify: `src/components/chat/NewChatComposer.tsx`
- Modify: `src/components/conversation/Composer.tsx`
- Modify: `src/components/conversation/ConversationWorkspace.tsx`
- Modify: `src/components/conversation/conversation-model.ts`
- Modify: `src/components/conversation/conversation-model.test.ts`
- Modify: `src/components/conversation/ConversationWorkspace.test.tsx`
- Modify: `src/index.html`

**Interfaces:**
- `mergeConversationItems(..., options?: { preferAuthoritative?: boolean; assistantName?: string })` uses `assistantName` for agent-message titles and defaults to a neutral `Assistant` label for pure callers.
- Composer placeholders use `useBranding()?.assistantName` with the same neutral fallback.

- [ ] **Step 1: Add failing tests** for a custom assistant name flowing through `mergeConversationItems` and for browser-safe composer/provider rendering.
- [ ] **Step 2: Run the focused Vitest files** and verify they fail because the model ignores `assistantName` and the UI does not consume branding.
- [ ] **Step 3: Implement the model option and provider-backed composer/workspace labels**, preserving all dynamic server-provided names and internal protocol strings.
- [ ] **Step 4: Change the HTML fallback title to a neutral `Desktop` title**; the native setup/provider will apply the configured title at runtime.
- [ ] **Step 5: Run the focused Vitest files** and verify they pass.

### Task 4: Verify the complete template change

**Files:**
- Modify: `src-tauri/capabilities/default.json` only if its static description remains an unnecessary user-facing brand leak.
- Modify: `docs/superpowers/specs/2026-11-04-tauri-branding-design.md` if implementation details require clarification.

- [ ] **Step 1: Run `make check-tests`** and fix only regressions caused by this change.
- [ ] **Step 2: Run `make rust-test`** and confirm the native bridge and existing Rust tests pass.
- [ ] **Step 3: Run `make verify`** if the environment supports the full template checks; record unrelated failures explicitly if present.
- [ ] **Step 4: Run `git diff --check` and inspect the final diff**, confirming no unrelated user changes were altered.
