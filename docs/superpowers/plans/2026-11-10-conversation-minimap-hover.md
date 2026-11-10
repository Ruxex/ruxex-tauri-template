# Conversation Minimap Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend conversation minimap hover influence to seven markers with a normal-distribution-like rightward falloff, and hide the minimap until five user messages exist.

**Architecture:** Keep the behavior local to `ConversationMinimap`. Derive hover distance once per marker, map distances 0–3 to explicit marker classes, and return `null` for fewer than five user-message markers. Preserve existing positioning, navigation, active state, and tooltip behavior.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-10-conversation-minimap-hover-design.md`

## Global Constraints

- A hovered marker affects itself and up to three neighboring user-message markers on each side, for a maximum of seven markers.
- Rightward offsets use the fixed non-linear sequence `14px`, `10px`, `5px`, `2px` for distances 0–3.
- The minimap is absent below five user-message markers and visible at five.
- Existing marker navigation, active-marker behavior, tooltip behavior, and responsive placement remain unchanged.

## Review Focus

- Five-message boundary: exactly five user messages render the minimap; four do not.
- Edge hover: a first or last marker only affects the available neighbors and does not require seven items.
- Distance cutoff: a fourth neighbor remains neutral and has no rightward offset.
- Intermediate falloff: offsets are non-linear rather than evenly spaced.
- Non-user timeline items: assistant/activity items do not count toward the five-marker threshold.

### Task 1: Extend minimap hover influence and visibility threshold

**Files:**
- Modify: `src/components/conversation/ConversationMinimap.tsx`
- Test: `src/components/conversation/ConversationMinimap.test.tsx`

**Interfaces:**
- Consumes: existing `ConversationMinimap` props and `ConversationViewItem[]` filtering.
- Produces: unchanged public component props; hover marker classes and visibility now follow the spec.

- [x] **Step 1: Add failing tests for the five-message threshold and seven-marker falloff**

  Update the existing minimap tests so a four-user-message conversation expects no
  complementary minimap, while five user messages render it. Add a hover test
  with seven user messages and assert the center, distance-1, distance-2, and
  distance-3 markers receive the expected offset classes, while the distance-4
  markers remain unshifted. Include an assistant item in the threshold case to
  prove only user messages count.

- [x] **Step 2: Run the focused test and verify it fails for the missing behavior**

  Run: `pnpm exec vitest run src/components/conversation/ConversationMinimap.test.tsx`

  Expected: FAIL because the current component renders one-message minimaps,
  only styles two neighbors, and has no third-neighbor offset.

- [x] **Step 3: Implement the minimal distance-table behavior**

  In `ConversationMinimap.tsx`, return `null` when `userItems.length < 5`.
  Compute the absolute hover distance for each marker, apply effects only for
  distances 0–3, and use explicit classes corresponding to `14px`, `10px`,
  `5px`, and `2px`. Keep the existing active marker styling and neutral styling
  for markers outside the influence window.

- [x] **Step 4: Run the focused test and verify it passes**

  Run: `pnpm exec vitest run src/components/conversation/ConversationMinimap.test.tsx`

  Expected: all minimap tests pass, including the new visibility and seven-marker
  hover assertions.

- [x] **Step 5: Run the full frontend verification suite**

  Run: `make verify`

  Expected: typecheck, lint, all Vitest tests, Python tests, and production build
  pass with exit code 0.

- [x] **Step 6: Commit the implementation**

  ```bash
  git add docs/superpowers/specs/2026-11-10-conversation-minimap-hover-design.md \
    docs/superpowers/plans/2026-11-10-conversation-minimap-hover.md \
    src/components/conversation/ConversationMinimap.tsx \
    src/components/conversation/ConversationMinimap.test.tsx
  git commit -m "feat(chat): expand minimap hover influence"
  ```
