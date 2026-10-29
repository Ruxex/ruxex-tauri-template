# Ruxex desktop agent instructions

This directory contains the Ruxex Tauri desktop application. These rules
supplement the parent repository instructions in `../AGENTS.md`; preserve the
independent Ruxex identity and all required copyright, license, third-party,
and upstream provenance notices.

## Product and data boundaries

- Use Ruxex names for repository-owned desktop code and documentation.
- Preserve names required by external protocols, endpoint URLs, fields,
  authentication variables and headers, model IDs, third-party packages, and
  legal or historical attribution.
- Keep provider-specific HTTP, credentials, wire formats, and errors behind the
  provider boundary. Threads and rollouts must not select providers or persist
  credentials.
- Treat the App Server protocol as authoritative for thread history, projects,
  goals, attachments, queued turns, approvals, model selection, and runtime
  state. The frontend must not invent or persist server-backed state.
- Limit client-local persistence to versioned presentation state such as theme,
  density, and panel visibility.
- Show unknown future protocol items as collapsed activity details rather than
  guessing their meaning.

## Desktop UI and design

- Express meaning through design and interaction, not explanatory prose.
- Do not add explanatory paragraphs, redundant helper text, or instructions
  when visual hierarchy, layout, grouping, iconography, color, state, or an
  affordance can communicate the same meaning.
- When the UI is unclear, improve the visual design or interaction before
  adding more explanatory text.
- Keep visible text concise and purposeful: use it for names, action labels,
  statuses, errors, and necessary empty-state guidance. Icon-only controls must
  still have accessible names.
- Keep desktop UI behavior and visual language consistent with the existing
  workbench, project, thread, and composer patterns.

## Development and verification

- Use the pinned toolchains and the repository `Makefile` as the supported
  local verification entrypoint.
- For frontend changes, run `make check-tests`; for a complete desktop change,
  run `make verify`.
- Use `make package-test` when runtime-package staging behavior changes and
  `make rust-test` when Tauri or Rust bridge code changes.
- Use `make build` for an explicit frontend or desktop build check.
- Do not invoke Cargo, `rustc`, linkers, or build scripts directly for
  repository builds; use the Makefile recipes.
- Before reporting completion, run `git diff --check` and inspect the final
  diff. Preserve unrelated changes and report unrelated failures explicitly.

## Repository boundaries

- Do not add private plans, `.codex`, `.vscode`, `.superpowers`, credentials,
  generated local state, or machine-specific paths to the public tree.
- Keep staged runtime binaries and other platform-specific build artifacts out
  of Git unless the repository explicitly requires them.

## Git

- Work in the current checkout; do not create worktrees unless requested.
- Do not reset, rewrite history, change remotes, push, or create pull requests
  unless explicitly requested.
