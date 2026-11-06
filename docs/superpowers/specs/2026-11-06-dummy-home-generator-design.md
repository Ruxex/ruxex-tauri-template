# Dummy home generator design

## Intent

Provide a repeatable WDIO operation that creates a minimal Ruxex home using
the real desktop app and DummyProvider. The generated home is for local UI
development and screenshot checks; it is not committed to the repository.

## Goals

- Create durable state through the same UI/App Server path as a real user.
- Start from an empty home on every run, so rerunning does not duplicate data.
- Keep the generated home under a short ignored repository directory for easy
  inspection and reuse.
- Begin with one completed basic conversation and leave volatile requests out
  of this fixture.

## Non-goals for the first version

- Approval, user-input, streaming, or other in-memory pending states.
- Projects and workspace roots. Workspace roots are absolute paths and will be
  added later under the ignored fixture directory when needed.
- Direct SQLite/JSONL writes.
- Committing generated home data.

## Approaches

1. **Direct database fixture**: small and fast, but it can create state that
   could never be produced by the application and violates the desired shape.
2. **WDIO against an isolated temporary home**: uses the real UI and App
   Server, but needs runner support to preserve the home after the test.
3. **Protocol-only seed utility**: can cover server features without UI
   controls, but does not validate the UI operation path and is better suited
   to later states such as custom sections or persistent attachments.

The selected approach is (2). The first version extends the existing Tauri
E2E runner with a persistent-home mode and adds a dedicated WDIO spec.

## Proposed behavior

- Add an ignored directory `.d/`. It is intentionally short because the
  App Server Unix socket path is nested below `RUXEX_HOME` and has a platform
  path-length limit.
- Add a command such as `make prepare-dummy-home` that builds the debug app
  and runs `fixtures/dummy-home/prepare.spec.ts` headfully for now. Headless
  execution can be added after the Xvfb dependency is available.
- In persistent-home mode, clear only the known directory
  `.d/` before launching the app.
- Use that directory as the isolated `HOME`, with `RUXEX_HOME` and XDG
  directories below it.
- The WDIO fixture scenario waits for the initial composer, sends one deterministic
  DummyProvider basic message, waits for navigation to the chat, and waits for
  the turn to finish.
- The runner terminates isolated descendants after WDIO exits but does not
  delete the persistent home.
- A second run starts from the cleared directory and produces one fresh
  conversation rather than adding another one.

## Verification

- Unit-test the runner's persistent-home path and cleanup behavior.
- Run the new WDIO spec twice and verify that the second run succeeds from the
  same path without duplicate data.
- Relaunch the app using the generated home and verify that the conversation
  appears in the chat list.

## Later extension points

The scenario can grow by adding independent WDIO helpers for projects,
multiple completed turns, tools, errors, goals, images, archives, and queues.
Those helpers should keep the same reset-before-run contract. States that are
not exposed by the current UI can later use a separate protocol setup path,
without changing this UI-driven fixture's role.
