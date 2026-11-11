# App Server controls, Skill roots, and MCP disclosure design

## Goal

Make the three capability surfaces reflect their actual state:

- App Server lifecycle actions are shown only when they are meaningful.
- Skills can discover additional absolute directories through the existing App Server protocol.
- Each MCP server is independently collapsible on the Capabilities page.

## Decisions

### App Server

The daemon action row follows this matrix:

| daemon state | actions |
| --- | --- |
| running / alreadyRunning / started / restarted | Reconnect, Restart, Stop, Force stop |
| stopped / notRunning / unavailable | Start |
| InProcess or unavailable native runtime | no daemon actions |

Reconnect is a running-daemon action and is therefore hidden when the daemon is not running.

### Skills

The protocol already provides `skills/extraRoots/set` with an absolute-path array. The UI uses Tauri's native directory picker, keeps the selected roots in the current page session, and submits the complete list after each add/remove operation. The server refreshes the Skills query after a successful update.

There is no protocol getter for the current extra-root list, so the UI does not pretend that `skills/list` source groups are the configured list. The UI labels these as additional directories for the current session.

### MCP

Each MCP server is rendered as a native `<details>` element, collapsed by default. The summary keeps the server name and status visible; tool counts, authentication actions, and errors are disclosed inside the panel.

## Verification

Focused Vitest coverage will assert the App Server state matrix, the Skills extra-root method mapping and UI submission, and the MCP default-collapsed state. The full repository verification remains the final gate.
