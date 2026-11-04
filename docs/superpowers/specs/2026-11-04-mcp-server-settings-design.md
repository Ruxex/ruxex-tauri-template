# MCP Server Settings Design

## Intent

Allow users to add, edit, and delete globally configured MCP servers from the
Ruxex Desktop Settings UI instead of editing `config.toml` manually. The UI
must manage only entries in the user's global configuration layer and must
leave project, system, enterprise-managed, and Plugin-owned configuration
untouched.

## Goals

- Add a dedicated `MCP servers` page under the Settings System section.
- Read the editable server list from the App Server's active `user` config
  layer, not from the effective MCP runtime catalog.
- Support the two user-configurable transports already accepted by Ruxex:
  stdio and Streamable HTTP.
- Add and edit a server as one validated configuration value.
- Delete a server with explicit confirmation.
- Reload the MCP runtime after a successful config write and refresh the UI.
- Surface configuration-validation, version-conflict, write, and reload errors
  without losing the user's form input.
- Preserve the existing MCP status page and its read-only runtime behavior.

## Non-goals

- Editing project, system, enterprise-managed, or Plugin-owned MCP entries.
- Adding a new MCP-specific App Server protocol; use the existing config write
  and MCP reload methods.
- Managing OAuth login, credentials, or the MCP credential store from this
  page. OAuth login remains a separate capability.
- Managing advanced per-tool policies, tool allow/deny lists, environment
  placement, or enterprise authentication in the first version.
- Replacing the existing `Capabilities > MCP` runtime/status view.
- Directly reading or writing `config.toml` from the browser/Tauri frontend.

## Anti-goals

- Do not treat the effective MCP status list as the editable configuration;
  it may include entries from higher-priority layers or Plugins.
- Do not persist raw bearer tokens or invent a frontend-only server registry.
- Do not silently overwrite a newer user configuration version.
- Do not claim that a delete removed a server from the effective runtime when a
  higher-priority layer supplies the same server name.

## Approaches

1. **Reuse `config/read` + `config/batchWrite` + MCP reload (selected).** Read
   the user layer through the existing App Server protocol, write one
   `mcp_servers` entry with `config/batchWrite`, and call
   `config/mcpServer/reload` after a successful write. This reuses server-side
   TOML parsing, validation, user-layer restrictions, version checks, and
   runtime refresh. It also supports an atomic rename as an upsert plus a
   deletion in one batch.
2. **Add MCP-specific App Server commands.** A dedicated add/remove API would
   make the frontend payload smaller, but would duplicate the existing config
   write semantics and require a new protocol, Rust processor, generated
   schema, and test surface without adding capability the server lacks.
3. **Edit `config.toml` directly from the frontend.** This would bypass the
   App Server's layer and validation boundary, make concurrent edits unsafe,
   and require the UI to reproduce TOML serialization and reload behavior.
   It is rejected.

## Design

### Navigation and page layout

- Add `MCP servers` to the Settings `System` navigation, pointing to
  `/settings/mcp-servers`.
- The page uses the existing Settings page width, heading, `SettingsPanel`,
  divided-row, button, and error-state patterns.
- The page has two sections:
  - `Add MCP server`: a form for creating a new user-layer entry.
  - `Configured MCP servers`: a list of user-layer entries with edit and
    delete actions.
- Empty state text is concise: `No global MCP servers configured.`
- Each row may show the matching runtime status from `mcpServerStatus/list`
  and tool count, but the presence and editable fields come only from the
  user layer.
- If the same name remains effective after deletion because another layer
  provides it, show a non-blocking status note that the global user entry was
  removed but another configuration source is still active.

### Editable configuration model

The frontend introduces a narrow form model rather than exposing the generic
JSON configuration object directly:

- Identity: `name`.
- Shared fields: `enabled` and `required`.
- Transport: `stdio` or `streamableHttp`.
- Stdio fields: required `command`, ordered `args`, optional `cwd`, and
  environment-variable references (`env_vars`) with optional `local` or
  `remote` source.
- Streamable HTTP fields: required `url`, optional
  `bearer_token_env_var`, and environment-backed HTTP headers.

The first version does not offer raw secret values, OAuth client secrets, or
advanced policy fields. The form validates required fields, rejects duplicate
names on add, keeps names non-empty, and serializes a name safely in a config
key path by quoting and escaping it. Existing names containing punctuation
remain addressable; the UI does not impose a narrower server-name grammar.

The form adapter uses this exact serialization rule for `env_vars`: a local
entry without an explicit source is serialized as a string; an entry with a
source is serialized as `{ name, source }`. HTTP environment-backed headers
are serialized as the `env_http_headers` string map. New entries omit optional
defaults such as `environment_id`, `auth`, empty arrays, and absent booleans.

When editing an existing entry, the adapter starts from the original object
and overlays only fields represented by the form. This preserves unsupported
existing fields such as OAuth or per-tool policy settings even though the
first-version UI does not edit them. A newly created entry contains only the
supported form fields.

### Read path and layer boundary

- Add a query hook for `config/read` with `{ includeLayers: true }`.
- Locate the layer whose source type is `user`; extract only its
  `mcp_servers` object. If no user layer or map exists, treat it as empty.
- Do not use `config.config.mcp_servers` as the source of editable rows because
  that is the effective merged configuration and may contain non-user entries.
- Keep the user layer's `version` with the query result for optimistic
  concurrency protection.
- If a user-layer entry is not an object or cannot be normalized into the
  supported display model, show it as an invalid read-only row with its name
  and validation message; offer deletion as a recovery action but no edit.
  If the whole `config/read` request fails, show the page-level error and do
  not attempt mutations.
- Query runtime status separately with the existing full-detail MCP status
  hook, fetching every page until `nextCursor` is null, and join rows by
  server name only for display.

### Write and reload flow

- Add a mutation hook for `config/batchWrite`.
- For create or same-name edit, send one edit:
  - `keyPath`: `mcp_servers."<escaped name>"`
  - `value`: the serialized form model
  - `mergeStrategy`: `replace`
  - `expectedVersion`: the current user-layer version
  - `reloadUserConfig`: `true`
- Omit `expectedVersion` when no user layer exists yet; the server creates the
  initial user layer and returns its first version.
- For a rename, send two edits in one batch: write the new quoted key with
  `replace`, then delete the old quoted key with `value: null` and
  `mergeStrategy: replace`.
- Reject a rename when the destination name already exists in the user layer;
  never overwrite another server implicitly.
- For delete, send one null-valued edit for the quoted server key with the
  current `expectedVersion`.
- After a successful write, call `config/mcpServer/reload`. Invalidate the
  config and MCP status queries after both operations.
- A write success followed by reload failure is represented as `Saved, but
  MCP reload failed`; do not retry or roll back automatically. The page keeps
  a retryable reload action and the saved list.
- A config version conflict refetches the user layer, preserves the draft,
  and asks the user to review the current value before resubmitting.
- Detect a conflict from the App Server error data field
  `config_write_error_code: "configVersionConflict"`; do not classify it by
  matching the human-readable error message.
- A server-side validation error stays attached to the form and does not close
  the dialog or clear input.

### Form interaction

- Use a modal/dialog for add and edit so the list remains visible behind it.
- Transport selection switches between the stdio and HTTP field groups while
  preserving the draft for the selected mode.
- Save is disabled while a write or reload is pending; cancel never writes.
- Delete requires a confirmation dialog naming the server and stating that it
  removes only the global user configuration entry.
- After save or delete, close the dialog only after the write succeeds; reload
  errors remain visible on the page.
- All icon-only controls have accessible names; keyboard focus returns to the
  invoking row after a dialog closes.

### Error and status behavior

- Show loading, empty, query-error, mutation-error, and reload-error states in
  the same visual language as existing Settings pages.
- Show runtime status as supplemental information, never as proof that the
  user-layer entry exists.
- Treat `okOverridden` from the config write response as a successful write
  with a warning that a higher-priority layer overrides the value.
- Keep the existing `CapabilitiesPage` MCP reload control unchanged.

## Constraints

- Frontend changes belong in the Tauri template; generated protocol files are
  read-only inputs and must not be hand-edited.
- The App Server remains authoritative for configuration, validation, layer
  ownership, versioning, and runtime state.
- Do not persist form drafts or server configuration in browser/Tauri local
  storage.
- Preserve unrelated working-tree changes already present in the template.
- Follow existing React Query, React Router, TypeScript, Tailwind/DaisyUI,
  and Vitest conventions.

## Verification expectations

- Unit-test key-path quoting/escaping and user-layer extraction, including no
  user layer, non-user layers, duplicate names, and a name containing dots.
- Test query and mutation hooks for exact `config/read`, `config/batchWrite`,
  and `config/mcpServer/reload` payloads plus query invalidation.
- Test the page for empty state, add, edit/rename, delete confirmation,
  validation errors, version conflicts, reload errors, and effective status
  that persists from another layer after a user delete.
- Run the template's supported frontend checks and `git diff --check` before
  implementation is reported complete.

## Builder decisions left open

- Exact component/file decomposition and local naming should follow the
  existing Settings and hook patterns.
- Exact labels, spacing, and icon choices should follow the current desktop
  visual language while keeping the interaction requirements above.
- The implementation may use one dialog component for add/edit if that keeps
  the form model and tests focused.
