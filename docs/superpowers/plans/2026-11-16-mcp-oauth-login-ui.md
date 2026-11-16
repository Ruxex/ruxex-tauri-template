# MCP OAuth Login UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users explicitly start OAuth for eligible MCP servers from Tauri settings and refresh status after OAuth completes.

**Architecture:** Share the existing OAuth request, URL validation, browser open, and per-server error UI between the MCP settings and Capabilities surfaces. Synchronize the MCP status query when the backend reports successful login completion.

**Tech Stack:** React, TypeScript, TanStack Query, existing app-server protocol and Tauri browser bridge.

**Spec:** `docs/superpowers/specs/2026-11-16-mcp-oauth-login-ui-design.md`

## Global Constraints

- Browser login starts only after an explicit click.
- Registration and enabled state remain independent of OAuth login.
- Enabled servers expose OAuth login only for typed authentication-required/not-logged-in states; disabled Streamable HTTP servers can be authenticated explicitly.
- Keep errors scoped to the server row.

## Review Focus

- Disabled Streamable HTTP servers still expose login.
- Stdio servers do not expose OAuth login; enabled servers with unknown auth state do not get a speculative button.
- Invalid authorization URLs never reach the browser bridge.
- OAuth completion refreshes status only after success.
- One server's login error does not affect other rows.

---

### Task 1: Add shared server-local OAuth action and status synchronization

**Files:**
- Create: `src/components/mcp/McpOAuthLoginAction.tsx`
- Modify: `src/pages/capabilities/McpCapabilitiesPanel.tsx`
- Modify: `src/pages/mcp-servers/McpServerList.tsx`
- Modify: `src/app-server/event-query-sync.ts`
- Modify: `src/app-server/hooks/useMcpQueries.ts`

- [x] Move the OAuth login request, URL validation, browser opening, pending state, and inline error into `McpOAuthLoginAction`.
- [x] Use the action in the MCP settings row for Streamable HTTP servers with an appropriate auth status; keep it independent of the Enabled switch.
- [x] Use the same action in Capabilities for `authenticationRequired`, `notLoggedIn`, and `oAuth` states.
- [x] Invalidate MCP status queries when `mcpServer/oauthLogin/completed` reports success.
- [x] Do not invalidate status when OAuth login only returns the authorization URL.
- [x] Run the repository's typecheck/lint commands if available; no tests are added or run under the task constraints.
