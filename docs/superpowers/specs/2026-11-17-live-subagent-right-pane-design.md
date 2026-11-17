# Live Subagent Right Pane

## Intent

Open a subagent's conversation from the parent thread summary in a tab in the global right pane. Make the live execution state and pending requests usable from both the parent conversation and the subagent tab.

## Behavior

- The collapsed subagent summary shows a localized count in parentheses instead of identicons.
- Selecting a subagent opens or selects a single right-pane tab keyed by its thread ID.
- The tab shows stored conversation history merged with that subagent's live event state. It does not create or resume a separate run.
- The tab stays open after completion and keeps showing the final conversation.
- Pending requests for subagents at any depth under the parent appear both in the parent conversation timeline and in the corresponding subagent tab. The parent timeline identifies the requesting subagent. Resolving a request from either view removes it from both through the shared event state.
- The subagent tab has no message composer; pending request cards remain actionable there.

## Approaches

- Snapshot-only subagent details would reuse the current history-only component, but would not show messages arriving during execution.
- A live conversation viewer uses the existing event store and timeline, keeps request cards actionable, and omits the composer. This is selected because active work and approvals remain observable without creating another run.

## Scope

Use the existing global right-pane tab system and direct child list for the summary. Use the ancestor-filtered thread list for nested descendant approvals. Preserve current tab behavior for Git diff and terminal views. Do not add a composer in the subagent tab.
