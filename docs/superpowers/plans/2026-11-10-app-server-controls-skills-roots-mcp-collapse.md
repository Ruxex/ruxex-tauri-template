# App Server controls, Skill roots, and MCP disclosure implementation plan

> Execute this plan task by task with tests first. Do not modify generated protocol files.

**Goal:** Make App Server actions state-aware, let the Skills UI add native directory roots, and make each MCP server collapsible.

**Spec:** `docs/superpowers/specs/2026-11-10-app-server-controls-skills-roots-mcp-collapse-design.md`

## Task 1: State-aware App Server controls

- [ ] Add failing tests for running and stopped/unavailable daemon action sets.
- [ ] Run focused App Server tests and confirm the new assertions fail.
- [ ] Render Reconnect/Restart/Stop/Force stop only for running statuses, and Start only otherwise.
- [ ] Run App Server and Settings tests.

## Task 2: Collapsible MCP servers

- [ ] Add a failing Capabilities test for a closed server details element.
- [ ] Run the focused Capabilities test and confirm it fails.
- [ ] Wrap each server in native `<details>` with summary status and disclosed details.
- [ ] Run the focused Capabilities tests.

## Task 3: Skills extra-root directory selection

- [ ] Add a failing hook mapping test for `skills/extraRoots/set`.
- [ ] Add a failing Skills UI test for native directory selection and complete-array submission.
- [ ] Run the focused hook/UI tests and confirm they fail.
- [ ] Implement `useSetSkillsExtraRoots`, native directory picker controls, add/remove state, and error handling.
- [ ] Run focused hook/UI tests.

## Task 4: Verification

- [ ] Run formatting, diff checks, and the repository verification command.
- [ ] Review the diff for generated-file changes and unrelated worktree changes.
