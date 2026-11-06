# MCP Elicitation Tauri Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the TauriTemplate UI to resolve MCP tool-approval elicitations instead of showing a reject-only generic server request.

**Architecture:** Keep the generated App Server protocol and backend unchanged. Add typed response construction in the existing approval model, then render `mcpServer/elicitation/request` in `ServerRequestCard`; the existing `resolveServerRequest` bridge will deliver the response to App Server, which already converts it to `ResolveElicitation`.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, generated App Server protocol types.

**Spec:** `docs/real-provider-smoke-test.md` RP-07 and the observed Cloudflare smoke-test failure.

## Global Constraints

- Do not edit generated protocol files.
- Do not auto-approve MCP calls; the user must choose Allow or Cancel.
- Preserve existing command/file approval and tool user-input behavior.
- Keep generic unsupported server requests reject-only.
- RP-06 uses the fixed, side-effect-free `/etc/hostname` reference to observe workspace-external read behavior.

## Review Focus

- MCP form elicitation uses `accept`/`cancel` responses with nullable content.
- MCP approval metadata and tool arguments are displayed without being required for response construction.
- Disconnected clients cannot resolve the elicitation.
- Existing command approvals and unsupported-request rejection remain unchanged.
- Decline/cancel responses do not accidentally execute the MCP tool.

### Task 1: Typed MCP elicitation response helpers

**Files:**
- Modify: `src/components/approvals/approval-model.ts`
- Test: `src/components/approvals/approval-model.test.ts`

- [ ] Write failing tests for `mcpServer/elicitation/request` responses: accept and cancel produce `{ action, content: null, _meta: null }`; unrelated requests return `null`.
- [ ] Run the focused Vitest test and verify it fails because the helper is missing.
- [ ] Implement the minimal typed helper using the generated `McpServerElicitationRequestResponse` and `McpServerElicitationAction` types.
- [ ] Run the focused test and verify it passes.

### Task 2: MCP elicitation card

**Files:**
- Modify: `src/components/approvals/ServerRequestCard.tsx`
- Test: `src/components/approvals/ServerRequestCard.test.tsx`

- [ ] Write failing UI tests for an MCP form elicitation: show server/tool context, expose Allow and Cancel while connected, and send the typed accept/cancel responses.
- [ ] Run the focused UI test and verify it fails because the card is currently generic/reject-only.
- [ ] Render MCP form elicitation data and call the response helper; keep generic requests on the existing Reject path.
- [ ] Run the focused UI test and verify it passes.

### Task 3: Regression and smoke documentation

**Files:**
- Modify: `docs/real-provider-smoke-test.md`
- Test: existing approval model, card, and full frontend test suites

- [ ] Verify RP-06 describes the external disposable path and expected Approval card.
- [ ] Run focused approval tests, typecheck, lint, and the full Vitest suite.
- [ ] Record any environment-only failures separately from implementation failures.
