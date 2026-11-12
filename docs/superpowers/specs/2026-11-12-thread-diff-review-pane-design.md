# Thread Diff Review in the Global Right Pane

## Intent

Let the user click the added/deleted line counts in the chat's Thread Summary and review the thread's uncommitted file changes in the global right pane.

## Existing structure

`BrowserNavigationBar` has the global right-pane toggle. `AppLayout` owns `rightPaneOpen`, its resizable panel/ref, and the currently empty `<aside aria-label="Right pane">`. The chat page's `ThreadSummaryPanel` is separate and remains the source of the clickable counts. The implementation must connect the summary action to `AppLayout`; it must not replace the chat summary column or create another drawer.

## Scope

- Make both aggregate added and deleted counts buttons that open the global right pane.
- Display all workspace changes in that pane, grouped by file.
- Show each file path and added/deleted line counts; sections start expanded and can be collapsed independently.
- Render a GitHub PR-like unified diff with old/new line numbers, context lines, green additions, and red deletions.
- Include staged, unstaged, and non-ignored untracked changes, consistent with the existing summary counts.
- Keep the global header toggle and existing resize handle behavior. Users can close the pane from the header or resize it with its existing handle.
- When the current thread changes, clear stale file-diff content; a click from the new thread loads that thread's workspace.

## Approaches

- **Fill the existing global right pane (selected):** pass an `openThreadDiff(threadId, workspace)` action from `AppLayout` to the chat route through outlet context. `AppLayout` stores the selected diff target, opens its existing right panel, and renders a file review component there. This uses the global pane and resizer already present.
- **Put the review in the chat's right summary column:** rejected because that is a different pane and is hidden by the chat's own responsive layout.
- **Add a drawer or modal:** rejected because it duplicates the global right pane and its existing open/close/resize controls.

## Interaction and layout

The line-count pair is one accessible button (for example, “Review 12 additions and 4 deletions”). Activating it records the current thread and workspace in `AppLayout`, then expands the global right pane. The pane shows a `Code Changes` heading, a compact file count/aggregate count, and the file sections. The global header button remains the close/open control; reopening preserves the selected thread's review until the thread changes.

Use the panel's existing resize handle rather than positioning a fixed overlay. The panel starts at a useful review width when opened from the count button (proposed 40% of the available horizontal group, clamped to 480–800px when space permits) and remains user-resizable. On narrow windows the existing panel constraints apply; the diff body scrolls horizontally for long lines and vertically within the panel. The chat stays visible in the main resizable panel.

Each file section uses a disclosure button keyed by file path and begins expanded when a new review target loads. A file's collapse state is independent of all other files. A changed target resets disclosure state. Binary files remain in the file list with a binary marker and no rendered text hunks. Git errors show a concise unavailable state; an empty detail response shows no changes.

## Data flow

`ConversationWorkspace` receives `openThreadDiff` through `useOutletContext` from `AppLayout` and passes thread ID plus thread `cwd` from the authoritative `thread/read` result. `AppLayout` stores the selected target, expands the existing panel ref, and supplies the target to the right-pane review component.

The frontend loads full diff details only when the right-pane review is selected. A Tauri command receives the workspace and returns sorted per-file records containing path, status, added/deleted counts, binary flag, and a unified patch. Tracked files compare against `HEAD`; untracked text files appear as additions. The command is read-only and never modifies Git's index or worktree. React Query keys details by workspace and thread, and refreshes while the pane is open when the aggregate summary changes.

## Diff viewer comparison

Snapshot taken 2026-11-12. Bundle figures are Bundlephobia minified JavaScript size and gzip size for the named npm package version; the final Vite chunk can differ because of tree shaking and code splitting.

| Candidate | GitHub stars | Latest package / release | Latest source push | Bundle size (min / gzip) | Features and trade-offs |
| --- | ---: | --- | --- | ---: | --- |
| [`@pierre/diffs`](https://github.com/pierrecomputer/pierre) | ~6,545** | 1.6.4 stable / 2026-11-04; 1.7.0-beta.3 available | Repo pushed 2026-11-12 | 502.7 KB / 133.3 KB main entry ([Bundlephobia](https://bundlephobia.com/package/%40pierre/diffs@1.6.4)) | The [`@pierre/diffs/react` adapter](https://diffs.com/docs#react-api) includes `CodeView` (virtualized multi-file list) and `PatchDiff`. Unified/split layouts, Shiki highlighting, theme adaptation, line selection, annotations, customizable headers. `CodeView` supports an item `collapsed` state, but custom header controls must toggle it and update the item's version. Apache-2.0. Stars belong to Pierre's monorepo, not the package alone. |
| [`react-diff-view`](https://github.com/otakustay/react-diff-view) | ~1,020 | 3.3.3 / 2026-03-30 | 2026-03-30 | 70.8 KB / 23.3 KB ([Bundlephobia](https://bundlephobia.com/package/react-diff-view@3.3.3)) | React components parse Git unified diff; unified and split views; GitHub-derived CSS; customizable rows and styles. File sections and collapse state are ours to build. Syntax highlighting is optional and needs a separate highlighter. MIT. |
| [`@git-diff-view/react`](https://github.com/MrWangJustToDo/git-diff-view) | ~743 | 0.1.8 / 2026-10-15 | 2026-11-11 | 1,069 KB / 338.3 KB ([Bundlephobia](https://bundlephobia.com/package/%40git-diff-view/react@0.1.8)) | Unified and split modes; syntax highlighting, theme support, workers, range rendering, React component. Newer and active, but adds a much larger bundle and several dependencies including highlight.js. MIT. |
| [`diff2html`](https://github.com/rtfpessoa/diff2html) | ~3,433 | 3.4.56 / 2026-01-31 | 2026-05-08 | 44.7 KB / 12.7 KB* ([Bundlephobia](https://bundlephobia.com/package/diff2html@3.4.56)) | GitHub-like unified/split HTML output; its UI supports file content toggles and sticky file headers. It integrates imperatively by drawing HTML into a DOM element rather than rendering React components; the full UI/highlighting path has additional code beyond the core size shown. MIT. |

`*` The diff2html size is for its core parser/renderer entry, not the full UI bundle with syntax highlighting.

`**` Pierre's 6,545 stars are for the `pierrecomputer/pierre` monorepo, which contains `@pierre/diffs`; this is not a package-specific star count. Bundlephobia reports the package's main entry plus its generated chunks, not the exact output of this app's `@pierre/diffs/react` subpath. The package has seven npm runtime dependencies and the adapter's production bundle should be confirmed with Vite after integration.

**Recommendation:** use `@pierre/diffs/react` with `CodeView`, loaded dynamically when the right pane first opens. It best matches the multi-file, all-expanded review: `CodeView` virtualizes line rendering for long diffs, supports a `collapsed` state per item, can render unified patch metadata, and adapts highlighting to a Shiki theme. Ruxex supplies custom file headers with path and per-file counts, and toggles each item's collapse state. The collapse interaction is app-owned; `CodeView` provides the state and virtualized renderer rather than an out-of-the-box accordion. Set stable item IDs and increment item versions when collapse state or diff content changes. Start without the experimental Worker Pool; the docs recommend measuring highlighter backends first, and state that Highlights usually performs best without a pool.

The cost is larger than `react-diff-view`: the Bundlephobia main entry is about 133.3 KB gzip and the package's Shiki/highlighting modules add async chunks. In the implementation build, the lazy `GitDiffReviewPane` chunk is 435.8 KB minified / 115.6 KB gzip; it stays out of the initial route bundle. Additional language/highlighter chunks load separately. The package is actively updated (stable 1.6.4 was published eight days before this snapshot, with 1.7 beta releases available), but its fast-moving API means pin the stable release and cover the adapter boundary with tests. `react-diff-view` remains the smaller fallback if the actual React subpath bundle or API churn proves too costly. `diff2html` remains the smallest core but its imperative HTML integration is less suitable for the controlled React pane.

## Non-goals

No staging, reverting, inline comments, hunk actions, branch/PR comparison, split-view toggle, or persisted per-file collapse state.

## Validation targets

- Clicking the count pair opens the existing global right pane and shows the current thread's files; header close/open and drag resize still work.
- Navigating to another thread clears the old diff target.
- Files appear in stable path order with exact per-file counts and start expanded; collapsing one leaves the others open.
- Tracked modifications, staged changes, untracked files, additions, deletions, binary files, and paths with spaces render safely.
- Slow detail requests show a loading state without blocking chat; Git errors and empty diffs remain recoverable.
- Dynamic import keeps the diff viewer out of the initial route chunk until needed.
