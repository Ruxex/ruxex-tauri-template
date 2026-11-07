# Screenshot Review UI Fixes Plan

## Task 1: Empty state and plugin detail layout

**Files:** `src/pages/CapabilitiesPage.tsx`, `src/pages/CapabilitiesPage.test.tsx`,
`src/pages/PluginDetailPage.tsx`, `src/pages/PluginDetailPage.test.tsx`

- [x] Add a tested empty Plugins card with explanatory text and a link to
  `/settings/marketplaces`.
- [x] Add a tested detail-layout class that lets a lone metadata section span the
  available content width while preserving a multi-section grid.
- [x] Add an `Installed` badge to installed plugin cards and test it.

## Task 2: Approval and asynchronous state clarity

**Files:** `src/components/approvals/ServerRequestCard.tsx`,
`src/components/approvals/ServerRequestCard.test.tsx`,
`src/components/conversation/ChatActivityTimeline.tsx`,
`src/components/conversation/ChatActivityTimeline.test.tsx`,
`src/components/conversation/QueuedMessages.tsx`,
`src/components/conversation/ConversationWorkspace.ui.test.tsx`

- [x] Put approval request scope metadata in a native disclosure, closed by default
  for compatibility while reducing visual prominence.
- [x] Render the active work label next to the loading indicator.
- [x] Add a visible `Queued messages` heading to the queue region.

## Task 3: Deterministic fixture framing and verification

**Files:** `fixtures/dummy-home/volatile.spec.ts`,
`fixtures/dummy-home/support.ts`, `README.md`

- [x] Add a helper to close the chat sidebar before volatile screenshots and use it
  consistently for the state captures.
- [x] Scroll the installed marketplace card into view before its screenshot.
- [x] Run focused tests, the full frontend suite, typecheck, lint, and the relevant
  WDIO fixture.

## Review focus

- Preserve approval actions and request resolution behavior.
- Preserve existing accessible names and route links.
- Do not modify marketplace image fallback behavior.
- Ensure screenshot framing changes do not write tracked artifacts.
