# GitHub Integration Plan

## Goal

Add repository-scoped GitHub workflows to the Ruxex desktop application, prepare and stabilize the Tauri backend first, and deliver the UI only after its backend contracts are ready.

## Decisions

- GitHub operations are discovered and authenticated per workspace/repository, not through a global Settings connection.
- GitHub.com and GitHub Enterprise Server use the installed `gh` CLI. GitLab and `glab` are a later extension.
- A Ruxex project may contain multiple workspaces. Issue and pull-request lists are scoped to the selected workspace; an aggregate view may be added later and must group by repository.
- Repository identity is independent from a local checkout, branch, or Worktree. A repository may appear in multiple projects or Worktrees.
- Thread associations and repository bindings belong in versioned Tauri-owned persistent data, not frontend presentation preferences or App Server thread history.
- Tauri owns local Git operations and GitHub CLI/API operations. The App Server remains authoritative for thread creation and turns.
- GitHub write operations are explicit GUI actions after the user reviews the prepared content. Agents do not create Issues or PRs directly.
- Screens and navigation are held until the backend operations and contracts below are ready.

## Approaches considered

1. **Build the GUI and backend together:** short feedback loop, but commits to screen and protocol choices before repository identity and associations are stable.
2. **Backend first, GUI last (selected):** stabilize discovery, repository identity, persistence, Issue/PR operations, and thread linkage before building the workspace selector, Issue views, and thread summary. This fits the requested later UI release.
3. **Global GitHub account integration:** convenient for GitHub.com, but mismatches per-workspace hosts, GitHub Enterprise, and the lower-priority GitLab requirement.

## Architecture

Model projects as collections of workspaces. Resolve each workspace to one or more local Git repository roots and remotes. Store a canonical remote identity (host and repository path, with the host's stable ID when available) separately from checkout paths and Worktree records. Store links between repository objects (Issues/PRs) and Ruxex threads as many-to-many records.

Invoke host-specific CLIs from Tauri with structured arguments and the selected repository as the working directory. Never send credentials to the frontend or store CLI tokens in Ruxex. Use Git commands for local branch, commit, diff, and Worktree state; use GitHub operations for Issues, PRs, and their remote status. Preserve the existing App Server as the source of truth for threads and turns.

Read GitHub state on demand rather than persisting a duplicate status cache in the first release. Persist only the local workspace/repository and GitHub object/thread relationships; a later UI can add a bounded refresh cache if live polling proves too expensive.

## Delivery sequence

### 1. Workspace, repository, and CLI discovery

- Resolve an existing workspace path to its Git root.
- Enumerate remotes and extract host, owner, and repository from HTTPS and SSH-style URLs without returning credential-bearing URL text.
- Detect `gh` and query authentication for the selected remote host without printing tokens; this supports GitHub.com and custom GitHub Enterprise hostnames.
- Return typed discovery states for non-Git workspaces, missing remotes, missing CLI, unauthenticated host, and multiple candidate remotes/targets.
- Expose only Tauri backend commands; add no UI or Settings entry.

### 2. Repository bindings and association storage

- Add a versioned `github-links.json` store under the product Ruxex Home, following the desktop scheduler's existing JSON persistence pattern and supporting schema migrations.
- Persist workspace-to-repository bindings and many-to-many repository object-to-thread links.
- Include App Server connection identity with thread ID to avoid collisions across server connections.
- Add typed read/write operations for bindings and links.

### 3. Local Git context

- Query branch, checkout root, Worktree status, commit state, and diff summaries for a thread workspace.
- Keep repository identity distinct from each checkout path.

### 4. Issue-to-thread backend

- List/search Issues and retrieve Issue body, labels, comments, and state for a selected repository.
- Start an App Server thread in the selected workspace, seed it with the Issue context and current checkout state, and persist the link.
- Start from the selected workspace checkout; the existing Tauri Worktree-create operation can prepare a separate checkout before thread startup.

### 5. PR backend

- Prepare and retrieve branch, diff, and commit state needed for PR creation.
- Create a PR, including Draft, after a caller confirms the prepared title/body and push action.
- Link one or more Issues to the PR and associate the PR with one or more threads.
- Keep Ruxex Issue links in the local association store. GitHub's own auto-close association still depends on the reviewed PR body containing a closing reference such as `Closes #123`.
- Retrieve basic PR state, review decision, mergeability, and check summary.
- Keep PR listing and reads host-aware through `gh` and refresh from GitHub on each request.
- Reject PR creation when the current checkout has uncommitted changes; require an explicit confirmation flag before push/create.

### 6. Requirements-to-Issues support

- Provide a requirements-planning Skill for clarifying scope, inspecting the repository and existing Issues, and drafting a task breakdown.
- Add backend operations that can validate and create reviewed Issue drafts in a batch.
- Package the planning Skill with the desktop. It emits structured drafts and performs only read-only repository/Issue research; the Tauri writer checks labels, milestones, duplicates, references, and dependency cycles before requiring explicit confirmation.
- Keep preview, editing, duplicate warnings, dependency review, and explicit approval in the later GUI.

### 7. UI release — last

- Add a workspace switcher to project-scoped Issue and PR views. Any optional aggregate view groups records by repository.
- Add Issue search/detail and Start Agent flow.
- Add branch, Worktree, Issue, and PR details to the thread summary.
- Add PR creation/status presentation and explicit review/confirmation before writes.
- Add the requirements planning draft editor and batch creation flow.

## Deferred scope

- GitLab and `glab` support.
- Selecting PR review comments/diff locations and passing their context to an Agent; replies and resolve actions.
- Downloading CI logs and passing failure context to an Agent, automatic failure detection, and retry limits.
- A global cross-workspace Issue/PR inbox.

Basic check summaries on a PR may be included in the PR status backend. CI log retrieval and Agent repair remain deferred.

## Completion criteria

- Repository and remote discovery is scoped to an explicit workspace and never silently chooses between different GitHub remotes.
- CLI authentication checks are host-specific and never expose tokens in results, logs, or errors.
- Persistent links support multiple workspaces, checkouts, Issues, PRs, and threads without making a project equal to a repository.
- Backend phases remain usable without introducing GitHub UI until the final delivery phase.
- User-visible GitHub writes require an explicit review/confirmation flow in the eventual GUI.

## Progress

- Steps 1–6 backend foundations are in place: per-workspace discovery, versioned repository/object/thread links, local checkout context, Issue list/detail/start, PR list/detail/prepare/create, and a packaged read-only requirements-planning Skill with Issue-draft validation and batch creation APIs. Step 7 adds a project GitHub page with a workspace/repository switcher, Issue search/detail/comments and Agent start, PR state/check/review/mergeability and related links, an Issue draft review/validation/batch-create dialog, and a thread summary with branch, Worktree, Issue/PR links, and reviewed PR preparation/creation. Issue and PR writes pass explicit confirmation; PR push requires a clean checkout. Issue drafts check duplicates, labels, milestones, parent/dependency references, and cycles, then report partial results if a GitHub batch write stops midway. Frontend typecheck, Biome/ESLint, locale catalog check, Rust `cargo check`, and Impeccable detection passed. Automated test suites and visual runtime inspection have not been run.
- [x] 1. Workspace, repository, and CLI discovery
- [x] 2. Repository bindings and association storage
- [x] 3. Local Git context
- [x] 4. Issue-to-thread backend
- [x] 5. PR backend
- [x] 6. Requirements-to-Issues support
- [x] 7. UI release
