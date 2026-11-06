# Tauri Capability Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tauri側の権限承認、個別Pluginアンインストール、Skills管理、MCP Resource閲覧を既存のApp Server経路で実装する。

**Architecture:** 生成済みprotocol型と`requestAppServerMethod`を利用し、React hooksでApp Server操作とquery invalidationをカプセル化する。既存の承認カード、Capabilitiesページ、MCP Serversページを拡張し、Rust/Tauri bridgeやApp Server本体には変更を加えない。

**Tech Stack:** React, TypeScript, TanStack Query, Vitest, Testing Library, Tauri App Server protocol

**Spec:** `docs/superpowers/specs/2026-11-06-tauri-capability-completion-design.md`

## Global Constraints

- `src/protocol/generated/**` は変更しない。
- App Serverをサーバー状態の唯一の管理元として扱い、フロントエンドに権限・Plugin・Skill・MCP状態を永続化しない。
- 未知の将来プロトコル項目は意味を推測せず、既存の汎用表示または折りたたみ詳細へ退避する。
- Resource textをHTMLとして描画せず、URIやMIME typeから外部URLを自動で開かない。
- Marketplace削除と個別Pluginアンインストールを同一操作にしない。
- フロントエンドの検証は`make check-tests`、最終検証は`make verify`を使う。

## Review Focus

- 権限要求の拒否時に権限を付与しないこと — Task 1で空のGranted profile（`{}`）と`scope: "turn"`を検証する。
- 権限の「セッション中」許可が選択されたscopeで送信されること — Task 1でradio操作とレスポンスを検証する。
- Pluginアンインストール後に古いPlugin・Skill・MCP状態を表示し続けないこと — Task 2で3つのquery rootのinvalidationを検証する。
- Skill mutation失敗時にUIが成功状態へ反転しないこと — Task 3でerror後の一覧再取得と表示を検証する。
- MCP ResourceのblobやHTML相当のtextを実行・HTML解釈しないこと — Task 4でtext/blob表示の安全境界を検証する。

## File map

- `src/components/approvals/approval-model.ts`: permission approvalの型判定とレスポンス生成。
- `src/components/approvals/ServerRequestCard.tsx`: permission内容、scope選択、許可／拒否UI。
- `src/components/approvals/approval-model.test.ts`: permission responseの純粋関数テスト。
- `src/components/approvals/ServerRequestCard.test.tsx`: permission approval UIの操作テスト。
- `src/app-server/hooks/useCapabilityQueries.ts`: Plugin uninstall、Skill write、MCP Resource read、Skill補助API。
- `src/app-server/hooks/useCapabilityQueries.test.tsx`: hooksのmethod mappingとcache invalidationテスト。
- `src/app-server/query-keys.ts` / `src/app-server/query-keys.test.ts`: MCP Resource query key。
- `src/pages/CapabilitiesPage.tsx`: Plugin uninstallとSkill toggle UI。
- `src/pages/CapabilitiesPage.test.tsx`: Plugin／Skill UIテスト。
- `src/pages/McpServersPage.tsx`: ServerごとのResource一覧と選択状態。
- `src/components/mcp/McpResourceViewer.tsx`: Resource内容の安全なtext/blob表示。
- `src/pages/McpServersPage.test.tsx` / `src/components/mcp/McpResourceViewer.test.tsx`: Resource閲覧テスト。

## Task 1: Permission approval response and UI

**Files:**
- Modify: `src/components/approvals/approval-model.ts`
- Modify: `src/components/approvals/ServerRequestCard.tsx`
- Test: `src/components/approvals/approval-model.test.ts`
- Test: `src/components/approvals/ServerRequestCard.test.tsx`

**Interfaces:**
- Consumes: generated `v2.PermissionsRequestApprovalParams`, `v2.PermissionsRequestApprovalResponse`, `v2.PermissionGrantScope` and existing `onResolve(result: unknown)`.
- Produces: `isPermissionsApproval(request: ServerRequest): boolean` and `buildPermissionsApprovalResponse(request: ServerRequest, decision: "accept" | "decline", scope: v2.PermissionGrantScope): v2.PermissionsRequestApprovalResponse | null` for the approval card.

- [ ] **Step 1: Write failing pure-function tests**

  In `approval-model.test.ts`, add a permissions request fixture containing `reason`, `cwd`, Network permission, and File System read/write entries. Assert:

  - Allow with `"turn"` returns the requested permissions and `scope: "turn"`.
  - Allow with `"session"` returns the requested permissions and `scope: "session"`.
  - Deny returns an empty Granted profile (`{}`) and `scope: "turn"`.
  - Non-permission requests return `null`.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run: `pnpm exec vitest run src/components/approvals/approval-model.test.ts`

  Expected: FAIL because the permission helper is not implemented.

- [ ] **Step 3: Implement permission response helpers**

  In `approval-model.ts`, add the exact helpers from the Interfaces block. Recognize only `item/permissions/requestApproval`. For Allow, copy non-null `params.permissions.network` and `params.permissions.fileSystem` into the optional Granted profile with the selected `scope`; for Deny, use an empty granted profile (`{}`) and `"turn"`. Keep existing command/file-change response behavior unchanged.

- [ ] **Step 4: Run the focused tests and verify pass**

  Run: `pnpm exec vitest run src/components/approvals/approval-model.test.ts`

  Expected: PASS, including all existing approval-model tests.

- [ ] **Step 5: Write failing approval-card UI tests**

  In `ServerRequestCard.test.tsx`, add a permissions pending request and assert:

  - The reason and requested Network/File System information are visible.
  - The default scope is turn-only.
  - Selecting the session option and clicking Allow calls `onResolve` with the typed permission response and `scope: "session"`.
  - Clicking Deny calls `onResolve` with an empty Granted profile (`{}`) and `scope: "turn"`.
  - Disconnected cards expose neither scope controls nor action buttons.

- [ ] **Step 6: Run the focused UI tests and verify failure**

  Run: `pnpm exec vitest run src/components/approvals/ServerRequestCard.test.tsx`

  Expected: FAIL because the card does not yet render permission details or scope controls.

- [ ] **Step 7: Implement permission approval presentation**

  In `ServerRequestCard.tsx`, add an `isPermissionsApproval` branch and type the request params as `v2.PermissionsRequestApprovalParams`. Render concise reason and permission summaries, two accessible scope radio controls (`turn`, `session`) defaulting to `turn`, and route Allow/Deny to `buildPermissionsApprovalResponse`. Preserve existing MCP elicitation, user input, command, and file-change behavior.

- [ ] **Step 8: Run approval tests and frontend checks**

  Run: `pnpm exec vitest run src/components/approvals/approval-model.test.ts src/components/approvals/ServerRequestCard.test.tsx` and then `make check-tests`.

  Expected: PASS with no new type or lint errors.

- [ ] **Step 9: Commit the permission approval slice**

  ```bash
  git add src/components/approvals/approval-model.ts src/components/approvals/approval-model.test.ts src/components/approvals/ServerRequestCard.tsx src/components/approvals/ServerRequestCard.test.tsx
  git commit -m "feat: handle permission approval requests"
  ```

## Task 2: Individual Plugin uninstall

**Files:**
- Modify: `src/app-server/hooks/useCapabilityQueries.ts`
- Modify: `src/app-server/hooks/useCapabilityQueries.test.tsx`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Create or modify: `src/pages/CapabilitiesPage.test.tsx`

**Interfaces:**
- Consumes: `v2.PluginUninstallParams`, `v2.PluginUninstallResponse`, existing `PluginSummary.id`, and `appServerQueryKeys.plugins`, `skills`, `mcpServers`.
- Produces: `useUninstallPlugin(): UseMutationResult<v2.PluginUninstallResponse, unknown, v2.PluginUninstallParams>` and an installed-plugin action in Capabilities.

- [ ] **Step 1: Write failing hook tests**

  In `useCapabilityQueries.test.tsx`, add `useUninstallPlugin` to the mutation mapping table. Assert it calls `requestAppServerMethod("plugin/uninstall", { pluginId: "example@community" })` and returns the server response. Add a separate invalidation assertion for plugins, skills, and MCP servers after success.

- [ ] **Step 2: Run the focused hook tests and verify failure**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: FAIL because `useUninstallPlugin` is not exported.

- [ ] **Step 3: Implement `useUninstallPlugin`**

  Extend the existing `PluginMutationParams` union and `usePluginMutation` method union with `v2.PluginUninstallParams` and `"plugin/uninstall"`. Export `useUninstallPlugin`, and on success invalidate `appServerQueryKeys.plugins`, `appServerQueryKeys.skills`, and `appServerQueryKeys.mcpServers`. Do not invalidate Marketplace configuration for this mutation.

- [ ] **Step 4: Run the focused hook tests and verify pass**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Write failing Plugin UI tests**

  Add `CapabilitiesPage.test.tsx` with mocked hooks and a minimal installed/non-installed marketplace fixture. Assert:

  - An installed non-official Plugin shows an accessible Uninstall action.
  - Clicking Uninstall after confirmation calls `mutateAsync({ pluginId })`.
  - Canceling confirmation does not call the mutation.
  - Official Apps remain unavailable for uninstall/install according to the existing policy.
  - Pending and error states are visible and prevent duplicate actions.

- [ ] **Step 6: Run the focused UI tests and verify failure**

  Run: `pnpm exec vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: FAIL because Capabilities currently has no individual uninstall action.

- [ ] **Step 7: Implement the Plugin uninstall action**

  Import `useUninstallPlugin` into `CapabilitiesPage.tsx`. For an installed Plugin, render a confirmation-backed `Uninstall <displayName>` action using `plugin.id`; for an uninstalled Plugin, preserve the existing Install action. Keep Marketplace remove in Settings only. Show `formatErrorMessage` for mutation errors and disable the affected action while pending.

- [ ] **Step 8: Run Plugin tests and frontend checks**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx src/pages/CapabilitiesPage.test.tsx` and then `make check-tests`.

  Expected: PASS.

- [ ] **Step 9: Commit the Plugin uninstall slice**

  ```bash
  git add src/app-server/hooks/useCapabilityQueries.ts src/app-server/hooks/useCapabilityQueries.test.tsx src/pages/CapabilitiesPage.tsx src/pages/CapabilitiesPage.test.tsx
  git commit -m "feat: add individual plugin uninstall"
  ```

## Task 3: Skills enable/disable management

**Files:**
- Modify: `src/app-server/hooks/useCapabilityQueries.ts`
- Modify: `src/app-server/hooks/useCapabilityQueries.test.tsx`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/pages/CapabilitiesPage.test.tsx`

**Interfaces:**
- Consumes: `v2.SkillsConfigWriteParams`, `v2.SkillsConfigWriteResponse`, `v2.SkillMetadata.path`, `v2.SkillMetadata.enabled`, and `appServerQueryKeys.skills`.
- Produces: `useWriteSkillConfig(): UseMutationResult<v2.SkillsConfigWriteResponse, unknown, v2.SkillsConfigWriteParams>` and per-Skill toggle UI.

- [ ] **Step 1: Write failing hook tests**

  Add `useWriteSkillConfig` to the mutation mapping table. Assert it calls `requestAppServerMethod("skills/config/write", { path: "/workspace/.agents/skills/review", enabled: false })` and returns `{ effectiveEnabled: false }`. Assert successful mutation invalidates `appServerQueryKeys.skills`.

- [ ] **Step 2: Run the focused hook tests and verify failure**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: FAIL because the Skill config mutation is not exported.

- [ ] **Step 3: Implement `useWriteSkillConfig`**

  Add a mutation that sends `skills/config/write` with the generated params type and returns the generated response. In `onSuccess`, invalidate `appServerQueryKeys.skills`; do not optimistically flip the Skill because `effectiveEnabled` and the refetched list are authoritative.

- [ ] **Step 4: Run the focused hook tests and verify pass**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Write failing Skills UI tests**

  Extend `CapabilitiesPage.test.tsx` with a Skills-tab fixture containing two Skills with distinct paths and enabled states. Assert:

  - Each Skill renders its current enabled state and an accessible toggle.
  - Toggling one Skill sends its `path`, never only its name.
  - The toggled row is pending without disabling unrelated rows.
  - A rejected mutation shows an error and does not change the rendered enabled state.

- [ ] **Step 6: Run the focused UI tests and verify failure**

  Run: `pnpm exec vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: FAIL because Skills are currently displayed only as comma-separated names.

- [ ] **Step 7: Implement Skill rows and toggle behavior**

  In `CapabilitiesPage.tsx`, import `useWriteSkillConfig`, render each `SkillMetadata` as a row under its cwd, and use `skill.path` as the mutation identity. Keep the server-provided `enabled` value as the displayed state; show pending/error state per path. Preserve discovery errors and empty states.

- [ ] **Step 8: Run Skills tests and frontend checks**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx src/pages/CapabilitiesPage.test.tsx` and then `make check-tests`.

  Expected: PASS.

- [ ] **Step 9: Commit the Skills toggle slice**

  ```bash
  git add src/app-server/hooks/useCapabilityQueries.ts src/app-server/hooks/useCapabilityQueries.test.tsx src/pages/CapabilitiesPage.tsx src/pages/CapabilitiesPage.test.tsx
  git commit -m "feat: manage skill enabled state"
  ```

## Task 4: MCP Resource viewer

**Files:**
- Modify: `src/app-server/query-keys.ts`
- Modify: `src/app-server/query-keys.test.ts`
- Modify: `src/app-server/hooks/useCapabilityQueries.ts`
- Modify: `src/app-server/hooks/useCapabilityQueries.test.tsx`
- Modify: `src/pages/McpServersPage.tsx`
- Modify: `src/pages/McpServersPage.test.tsx`
- Create: `src/components/mcp/McpResourceViewer.tsx`
- Create: `src/components/mcp/McpResourceViewer.test.tsx`

**Interfaces:**
- Consumes: `v2.McpServerStatus.resources`, root protocol `Resource` and `ResourceContent`, `v2.McpResourceReadParams`, and `v2.McpResourceReadResponse`.
- Produces: `appServerQueryKeys.mcpResource(server: string, uri: string, threadId?: string | null)` and `useMcpResource(params: v2.McpResourceReadParams | null)`.

- [ ] **Step 1: Write failing query-key and hook tests**

  Assert `mcpResource("docs", "resource://guide")` differs from another URI and does not collide with the MCP server list key. Add a hook test that calls `mcpServer/resource/read` with `{ server: "docs", uri: "resource://guide" }` and returns `{ contents: [...] }`. Assert a null params value leaves the query disabled.

- [ ] **Step 2: Run focused tests and verify failure**

  Run: `pnpm exec vitest run src/app-server/query-keys.test.ts src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: FAIL because the Resource key and hook are not implemented.

- [ ] **Step 3: Implement Resource query support**

  Add the Resource key factory and `useMcpResource` query. The query is enabled only when App Server is connected and params contain a non-empty server and URI. Omit `threadId` from settings-page calls; include it in the request only when supplied.

- [ ] **Step 4: Run focused query tests and verify pass**

  Run: `pnpm exec vitest run src/app-server/query-keys.test.ts src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Write failing Resource viewer tests**

  In `McpResourceViewer.test.tsx`, add text and blob fixtures. Assert:

  - Text is rendered in a non-HTML text container.
  - JSON-looking text is formatted as readable text without executing markup.
  - Blob content displays MIME type and metadata but not decoded executable content.
  - Empty contents and read errors have distinct accessible states.

- [ ] **Step 6: Run Resource viewer tests and verify failure**

  Run: `pnpm exec vitest run src/components/mcp/McpResourceViewer.test.tsx`

  Expected: FAIL because the viewer component does not exist.

- [ ] **Step 7: Implement `McpResourceViewer`**

  Create a presentation component that accepts `v2.McpResourceReadResponse | undefined`, loading, and error state. Render text with `textContent` semantics, pretty-print only valid JSON strings, and render blob entries as metadata. Do not use `dangerouslySetInnerHTML`, automatic URL navigation, or file execution.

- [ ] **Step 8: Write failing MCP Servers page tests**

  Extend `McpServersPage.test.tsx` fixtures so a connected server exposes one Resource and one ResourceTemplate. Mock `useMcpResource` and assert:

  - The Resource count/list is visible under the server.
  - Selecting a Resource calls the hook with the exact server name and URI.
  - The selected Resource shows the viewer state.
  - ResourceTemplate is labeled as dynamic and is not automatically read.

- [ ] **Step 9: Run page tests and verify failure**

  Run: `pnpm exec vitest run src/pages/McpServersPage.test.tsx`

  Expected: FAIL because MCP Servers currently show only tools/auth status.

- [ ] **Step 10: Implement Resource list and selection**

  In `McpServersPage.tsx`, add per-server Resource expansion/selection state keyed by server name and URI. Use `useMcpResource(selectedParams)` for the selected item, pass the response into `McpResourceViewer`, and keep ResourceTemplate display read-only without constructing a URI. Preserve existing server edit/delete/reload behavior.

- [ ] **Step 11: Run Resource tests and frontend checks**

  Run: `pnpm exec vitest run src/app-server/query-keys.test.ts src/app-server/hooks/useCapabilityQueries.test.tsx src/components/mcp/McpResourceViewer.test.tsx src/pages/McpServersPage.test.tsx` and then `make check-tests`.

  Expected: PASS with no unsafe HTML rendering or type errors.

- [ ] **Step 12: Commit the MCP Resource slice**

  ```bash
  git add src/app-server/query-keys.ts src/app-server/query-keys.test.ts src/app-server/hooks/useCapabilityQueries.ts src/app-server/hooks/useCapabilityQueries.test.tsx src/pages/McpServersPage.tsx src/pages/McpServersPage.test.tsx src/components/mcp/McpResourceViewer.tsx src/components/mcp/McpResourceViewer.test.tsx
  git commit -m "feat: browse MCP resources"
  ```

## Task 5: Optional Skills extra roots and Hook diagnostics

This task follows the required Skill toggle MVP. It may be committed separately if the UI surface becomes materially larger than the four core capabilities.

**Files:**
- Modify: `src/app-server/hooks/useCapabilityQueries.ts`
- Modify: `src/app-server/hooks/useCapabilityQueries.test.tsx`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/pages/CapabilitiesPage.test.tsx`

**Interfaces:**
- Consumes: `v2.SkillsExtraRootsSetParams`, `v2.SkillsExtraRootsSetResponse`, `v2.HooksListParams`, `v2.HooksListResponse`.
- Produces: `useSetSkillsExtraRoots`, `useHooksList`, and read-only Skills diagnostics UI.

- [ ] **Step 1: Write failing hook tests**

  Assert `useSetSkillsExtraRoots` maps to `skills/extraRoots/set` and invalidates Skills. Assert `useHooksList` maps to `hooks/list` and returns the server payload.

- [ ] **Step 2: Run focused hook tests and verify failure**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: FAIL because these hooks are not implemented.

- [ ] **Step 3: Implement the two hooks**

  Add typed mutation/query hooks using the generated protocol types. Keep extra roots server-authoritative and invalidate the Skills query after a successful write.

- [ ] **Step 4: Run focused hook tests and verify pass**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx`

  Expected: PASS.

- [ ] **Step 5: Write failing Skills diagnostics tests**

  Add page assertions for an extra-root control and a read-only Hook list.

- [ ] **Step 6: Run the focused Skills diagnostics tests and verify failure**

  Run: `pnpm exec vitest run src/pages/CapabilitiesPage.test.tsx`

  Expected: FAIL because the extra-root control and Hook list do not exist.

- [ ] **Step 7: Implement extra-root and Hook diagnostics UI**

  Add directory selection using the existing platform dialog pattern, submit the complete `extraRoots` array through `useSetSkillsExtraRoots`, and display `hooks/list` results without edit or execute actions. Keep these controls visually secondary to Skill enable/disable.

- [ ] **Step 8: Run Skills diagnostics tests and frontend checks**

  Run: `pnpm exec vitest run src/app-server/hooks/useCapabilityQueries.test.tsx src/pages/CapabilitiesPage.test.tsx` and then `make check-tests`.

  Expected: PASS.

- [ ] **Step 9: Commit the optional Skills management slice**

  ```bash
  git add src/app-server/hooks/useCapabilityQueries.ts src/app-server/hooks/useCapabilityQueries.test.tsx src/pages/CapabilitiesPage.tsx src/pages/CapabilitiesPage.test.tsx
  git commit -m "feat: add skill roots and hook diagnostics"
  ```

## Task 6: Full verification and manual acceptance

**Files:**
- Modify: none unless verification reveals a defect.

- [ ] **Step 1: Run frontend verification**

  Run: `make check-tests`

  Expected: Typecheck, lint, and all frontend tests pass.

- [ ] **Step 2: Run complete repository verification**

  Run: `make verify`

  Expected: Frontend checks, package tests, and build pass. If an unrelated pre-existing failure appears, record it with the command output rather than changing unrelated code.

- [ ] **Step 3: Run final diff hygiene checks**

  Run: `git diff --check` and inspect `git diff --stat` plus the complete diff. Confirm generated protocol files and unrelated user changes were not modified.

- [ ] **Step 4: Manual acceptance check**

  In the desktop app, verify one real request for each capability: approve/deny a permission request with both scopes, uninstall a non-official installed Plugin, toggle a Skill, and read MCP Resource text/blob content. Confirm errors and disconnected states do not leave misleading success UI.
