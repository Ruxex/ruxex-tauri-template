# MCP Server Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings page that manages global user-layer MCP server entries through the existing App Server configuration APIs.

**Architecture:** Keep the App Server authoritative. A focused frontend adapter extracts only the `user` config layer, converts MCP entries to a narrow form model, and serializes edits back to quoted `mcp_servers` key paths. The page coordinates a version-checked `config/batchWrite` followed by MCP reload, while the existing runtime MCP capabilities page remains unchanged.

**Tech Stack:** React 19, TypeScript, React Router, TanStack React Query, Heroicons, Tailwind/DaisyUI, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-04-mcp-server-settings-design.md`

## Global Constraints

- Edit only the global user configuration layer; do not write project, system, enterprise-managed, or Plugin-owned configuration.
- Use `config/read`, `config/batchWrite`, and `config/mcpServer/reload`; do not add a new MCP-specific App Server protocol.
- Do not hand-edit generated files under `src/protocol/generated/`.
- Preserve existing unsupported fields when editing an existing server; new entries contain only supported form fields.
- Omit `expectedVersion` when the user layer does not exist; otherwise use the user-layer version returned by `config/read`.
- Do not persist MCP configuration or form drafts in browser/Tauri local storage.
- Preserve unrelated working-tree changes already present in the template repository.
- Use the template Makefile for verification; do not invoke Cargo or build tools directly.

## Review Focus

- Effective config versus user-layer config: only the `user` layer's `mcp_servers` entries are editable; pin this in the extraction tests in Task 1.
- Key-path escaping: names containing dots, quotes, and backslashes must address the intended TOML key; pin this in Task 1.
- Existing unsupported fields and malformed entries: edits preserve unknown fields, while malformed entries are read-only but deletable; pin this in Task 1 and Task 3.
- Initial write and concurrent update behavior: omit `expectedVersion` for first write and classify `configVersionConflict` without string matching; pin this in Task 2 and Task 3.
- Runtime refresh behavior: fetch paginated status data and distinguish saved-but-reload-failed from write failure; pin this in Task 2 and Task 3.

---

### Task 1: Add the global MCP configuration adapter

**Files:**
- Create: `src/app-server/mcp-config.ts`
- Test: `src/app-server/mcp-config.test.ts`

**Interfaces:**
- Consumes: `v2.ConfigReadResponse` and `JsonValue` from the generated protocol types.
- Produces: `McpServerDraft`, `McpServerEntry`, `GlobalMcpConfig`, `extractGlobalMcpConfig(response)`, `mcpServerKeyPath(name)`, `draftFromEntry(entry)`, and `serializeMcpServerDraft(draft, original)` for the page and mutation orchestration.

- [ ] **Step 1: Write failing tests for layer extraction and key-path serialization**

  Add tests that assert:

  - only a layer with `name.type === "user"` contributes entries;
  - effective `response.config.mcp_servers` and `project`/`system` layers do not become editable rows;
  - no user layer returns an empty server map and an absent version;
  - `mcp_servers."a.b\\"c\\\\d"` is produced for a name containing `.`, `"`, and `\\`;
  - malformed/non-object entries become invalid entries with a readable error instead of throwing;
  - `env_vars` strings and `{ name, source }` objects normalize to the form model;
  - editing an existing raw object preserves unrepresented OAuth/tool-policy fields;
  - new stdio and HTTP drafts serialize with the exact supported field names and omit empty optional values.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `pnpm vitest run src/app-server/mcp-config.test.ts`

  Expected: FAIL because the adapter module and exported interfaces do not yet exist.

- [ ] **Step 3: Implement `src/app-server/mcp-config.ts`**

  Define the narrow draft shape for `name`, `enabled`, `required`, transport,
  stdio fields, HTTP fields, environment references, and environment-backed
  headers. Extract `mcp_servers` only from the user layer's object config,
  returning the raw object alongside the normalized entry so edit operations
  can overlay supported fields without deleting unsupported fields. Build a
  quoted key path by escaping backslashes and quotes. Serialize local
  environment references as strings and source-qualified references as
  `{name, source}` objects; omit empty arrays and optional defaults.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run: `pnpm vitest run src/app-server/mcp-config.test.ts`

  Expected: PASS.

### Task 2: Add query, pagination, write, and error helpers

**Files:**
- Modify: `src/app-server/hooks/useCapabilityQueries.ts`
- Modify: `src/app-server/query-keys.ts`
- Create: `src/app-server/mcp-config-errors.ts`
- Test: `src/app-server/hooks/useCapabilityQueries.test.tsx`
- Test: `src/app-server/mcp-config-errors.test.ts`

**Interfaces:**
- Consumes: `GlobalMcpConfig` and `mcpServerKeyPath` from Task 1, plus generated `v2.ConfigBatchWriteParams`.
- Produces: `useGlobalMcpConfig()`, `useAllMcpServerStatus()`, `useWriteConfig()`, and `getConfigWriteErrorCode(error)` for the page.

- [ ] **Step 1: Write failing hook and error-helper tests**

  Extend the hook tests to assert:

  - `useGlobalMcpConfig` requests `config/read` with `{ includeLayers: true }` and returns the adapter output;
  - `useAllMcpServerStatus` requests `mcpServerStatus/list` repeatedly using `nextCursor` and combines all pages;
  - `useWriteConfig` sends `config/batchWrite` unchanged and invalidates both `configRoot` and `mcpServers` on success;
  - a first-write payload omits `expectedVersion`, while an existing-layer payload includes it;
  - `getConfigWriteErrorCode` reads `error.data.config_write_error_code` and recognizes `configVersionConflict` without parsing the message.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `pnpm vitest run src/app-server/hooks/useCapabilityQueries.test.tsx src/app-server/mcp-config-errors.test.ts`

  Expected: FAIL because the new hooks and helper are not implemented.

- [ ] **Step 3: Implement the hooks and error helper**

  Add a dedicated global-config query that uses the adapter and a paginated
  status query that preserves `detail: "full"` while forwarding the opaque
  cursor. Add a generic config batch-write mutation that invalidates config and
  MCP status caches. Keep `useReloadMcpServers` available for the page's second
  phase. Expose a narrow error-code reader for the App Server's
  `config_write_error_code` response data.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run: `pnpm vitest run src/app-server/hooks/useCapabilityQueries.test.tsx src/app-server/mcp-config-errors.test.ts`

  Expected: PASS.

### Task 3: Build the MCP server form, dialog, and settings page

**Files:**
- Create: `src/pages/mcp-servers/mcp-server-form.ts`
- Test: `src/pages/mcp-servers/mcp-server-form.test.ts`
- Create: `src/pages/mcp-servers/McpServerDialog.tsx`
- Test: `src/pages/mcp-servers/McpServerDialog.test.tsx`
- Create: `src/pages/McpServersPage.tsx`
- Test: `src/pages/McpServersPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 form/serialization helpers and Task 2 query, write, reload, status, and error helpers.
- Produces: a page that lists only global user entries, opens add/edit dialogs, performs version-checked writes, confirms deletes, reloads MCP, and reports all required states.

- [ ] **Step 1: Write failing form-model tests**

  Test initial draft creation, stdio/HTTP field switching, required name/
  command/url validation, duplicate-name validation, rename collision
  validation, parsing of argument and header rows, and conversion back to the
  Task 1 serialization shape.

- [ ] **Step 2: Run the form tests and verify they fail**

  Run: `pnpm vitest run src/pages/mcp-servers/mcp-server-form.test.ts`

  Expected: FAIL because the form model module is not implemented.

- [ ] **Step 3: Implement the form reducer and validation**

  Keep the draft local to the dialog. Preserve transport-specific drafts while
  switching transport, normalize blank optional rows away, and return
  field-level errors without mutating the original entry.

- [ ] **Step 4: Run the form tests and verify they pass**

  Run: `pnpm vitest run src/pages/mcp-servers/mcp-server-form.test.ts`

  Expected: PASS.

- [ ] **Step 5: Write failing dialog tests**

  Assert accessible name/transport controls, add versus edit headings, input
  preservation on server validation error, disabled save while pending, and
  focus-return/close behavior through the existing dialog conventions.

- [ ] **Step 6: Run the dialog tests and verify they fail**

  Run: `pnpm vitest run src/pages/mcp-servers/McpServerDialog.test.tsx`

  Expected: FAIL because the dialog component is not implemented.

- [ ] **Step 7: Implement `McpServerDialog`**

  Use the existing `<dialog>`/DaisyUI pattern. Render common fields and the
  selected transport fields, expose accessible labels for icon-only close
  controls, and keep server-provided errors in the dialog. The dialog returns
  a validated draft to the page and does not perform App Server calls itself.

- [ ] **Step 8: Run the dialog tests and verify they pass**

  Run: `pnpm vitest run src/pages/mcp-servers/McpServerDialog.test.tsx`

  Expected: PASS.

- [ ] **Step 9: Write failing page tests**

  Mock the hooks and assert:

  - loading, query error, empty state, valid rows, invalid read-only rows, and runtime status/tool counts;
  - add submits one `replace` edit with the user-layer version or no version for the initial write;
  - same-name edit preserves unsupported raw fields and rename submits a new `replace` edit plus an old-key null deletion in one batch;
  - duplicate/rename collisions prevent mutation;
  - delete requires confirmation and sends a null-valued quoted key;
  - write success calls MCP reload and closes the dialog;
  - write failure keeps the draft open, while reload failure shows `Saved, but MCP reload failed` and a retry action;
  - `configVersionConflict` refetches config and preserves the draft;
  - deleting a user entry can leave a matching effective runtime status visible as a higher-layer warning.

- [ ] **Step 10: Run the page tests and verify they fail**

  Run: `pnpm vitest run src/pages/McpServersPage.test.tsx`

  Expected: FAIL because the page is not implemented.

- [ ] **Step 11: Implement `McpServersPage`**

  Render the two SettingsPanel sections, join user entries with paginated
  runtime status by name, orchestrate `batchWrite` then reload, track the
  saved-but-not-reloaded state, and keep drafts/errors local to the active
  dialog. Use the adapter's quoted key path and current user-layer version for
  every mutation. Allow delete for invalid rows but not edit.

- [ ] **Step 12: Run the page tests and verify they pass**

  Run: `pnpm vitest run src/pages/McpServersPage.test.tsx`

  Expected: PASS.

### Task 4: Register the route and Settings navigation

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.tsx`
- Modify: `src/components/sidebar/SettingsSidebar.test.tsx`
- Modify: `src/app/router.test.tsx`

**Interfaces:**
- Consumes: `McpServersPage` from Task 3.
- Produces: `/settings/mcp-servers` navigation under the existing System settings group.

- [ ] **Step 1: Write failing route and sidebar tests**

  Assert `matchRoutes` resolves `/settings/mcp-servers` to the new page and
  the sidebar exposes a link named `MCP servers` with that destination.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `pnpm vitest run src/app/router.test.tsx src/components/sidebar/SettingsSidebar.test.tsx`

  Expected: FAIL because the route and link are not registered.

- [ ] **Step 3: Register the page and navigation**

  Import `McpServersPage`, add the child route under `/settings`, and add an
  MCP icon/link in the System section without changing existing route behavior.

- [ ] **Step 4: Run the focused tests and verify they pass**

  Run: `pnpm vitest run src/app/router.test.tsx src/components/sidebar/SettingsSidebar.test.tsx`

  Expected: PASS.

### Task 5: Run complete verification

**Files:**
- Modify: none expected; only fix files owned by Tasks 1-4 if verification exposes an issue.

**Interfaces:**
- Consumes: all completed Tasks 1-4.
- Produces: verified frontend implementation with no generated-protocol edits or unrelated changes.

- [ ] **Step 1: Run the complete supported frontend checks**

  Run: `make check-tests`

  Expected: TypeScript, Biome/ESLint, and the complete Vitest suite pass.

- [ ] **Step 2: Run the frontend build**

  Run: `make build`

  Expected: Vite produces a successful production build.

- [ ] **Step 3: Inspect the final diff and whitespace**

  Run: `git diff --check` and `git status --short`; inspect that only the MCP
  settings files and the approved design/plan documents are new or modified,
  while the pre-existing unrelated working-tree changes remain untouched.

- [ ] **Step 4: Report verification results**

  Record the exact commands and pass/fail results, and call out any unrelated
  pre-existing failures without claiming success for them.
