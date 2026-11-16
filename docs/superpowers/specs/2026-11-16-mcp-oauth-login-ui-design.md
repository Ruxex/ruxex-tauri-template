# MCP OAuth Login UI Design

## Intent

Treat an MCP server's authentication-required startup result as a recoverable, server-local state. Starting OAuth and opening the browser must remain an explicit user action.

## Goals

- Keep registration and enabled state separate from OAuth login.
- Offer login for Streamable HTTP servers in MCP settings, including while disabled.
- Offer login from Capabilities when status indicates login or reauthentication is needed.
- Refresh MCP status after the OAuth completion notification reports success.
- Keep errors and pending state local to the server row.

## Non-goals and constraints

- Do not change backend startup, reload, or OAuth protocol behavior.
- Do not automatically open a browser when Initialize fails.
- Keep the existing visual system and button sizing.
- Do not offer OAuth login for stdio servers.

## Approach

Reuse the existing `mcpServer/oauth/login` request and browser URL validation in a small shared client component. For enabled servers, offer the action only when runtime status is `authenticationRequired` or auth status is `notLoggedIn`/`oAuth`. For disabled Streamable HTTP servers, offer it explicitly because disabled auth discovery does not report an auth state. Do not infer authentication requirements from error text. Do not refresh status when the browser flow is merely starting. An OAuth-success notification invalidates MCP status queries so the UI reflects the saved credentials and runtime refresh.

## Acceptance

- No browser opens until a user activates a login button.
- A failed server does not disable actions for other servers.
- OAuth errors appear beside the server whose login was attempted.
- A successful OAuth completion refreshes MCP status.
