# Chat Sidebar Alignment Design

## Intent

Align the disclosure chevron for each project with the `Projects` section
chevron, and make chats nested under a project use the same list-row structure
as chats under `Recent chats`.

## Scope

- Keep existing expand/collapse and navigation behavior.
- Adjust only the sidebar layout classes/structure and regression coverage.
- Do not redesign project or chat data loading.

## Approach

The selected approach is the minimal existing-structure fix: use the same
horizontal padding basis for project disclosure rows as the section summary,
and remove the extra nested menu wrapper effect around project chat rows while
retaining a visual indentation for the project scope. A shared disclosure
component was considered but is unnecessary for this localized issue.

## Verification

Extend `ChatSidebarSections.test.tsx` to assert the project disclosure icon
uses the section-aligned padding and project chat rows are rendered directly
as the same `ChatListItem` row pattern used by recent chats.
