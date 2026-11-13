# Right Pane Tabs

## Intent

Manage every right-pane view as a tab, starting with the Git diff review. This gives the global right pane a browser-like way to keep and switch between reviews. Closing the last tab closes the right pane.

## Behavior

- `AppLayout` owns an ordered list of right-pane tabs and the active tab ID.
- The first tab kind is `git-diff`, storing the existing thread ID and workspace target.
- A Git diff tab label includes the workspace directory name. Opening an already-open diff for the same thread and workspace selects its existing tab; a different target adds a tab.
- Tabs render in a tab strip at the top of the existing global right pane. Selecting a tab shows its content. Each tab has an accessible close button.
- Closing an inactive tab leaves the active tab unchanged. Closing the active tab selects the adjacent remaining tab (previous when available, otherwise next).
- Closing the final tab clears the active tab and closes the right pane. The global header toggle continues to hide/show the pane without discarding tabs.
- The header toggle may still open an empty right pane before any tab exists.

## Scope

Implement the tab model and Git diff tab only. Keep the existing resizable panel, global header toggle, diff viewer, and thread summary action. Do not persist tabs across application launches.

## Validation

- Opening a diff adds/selects the right tab and opens the right pane.
- Opening the same thread/workspace diff selects the existing tab rather than duplicating it.
- Opening another target adds a tab and switching tabs changes the displayed target.
- Closing an active tab selects a remaining tab; closing the last tab closes the pane.
- Header close/reopen preserves existing tabs.
