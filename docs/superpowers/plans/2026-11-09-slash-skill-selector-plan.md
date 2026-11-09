# Slash Skill Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal slash-command picker with a vertical command/skill selector and send selected skills as structured Composer inputs.

**Architecture:** Keep `SlashCommandPalette` presentation-focused: it receives the current query, command callbacks, and a flattened skill list plus loading/error state. Keep data fetching, selected-skill state, chip rendering, and send/steer/queue payload construction in `Composer`. Add pure slash-selection helpers for removing the slash token while preserving the remaining message.

**Tech Stack:** React 19, TypeScript, Tailwind/DaisyUI, TanStack Query, Vitest, Testing Library, Ladle.

**Spec:** `docs/superpowers/specs/2026-11-09-slash-skill-selector-design.md`

## Global Constraints

- Preserve existing Archive, Compact, and Goal command semantics.
- Use the existing `UserInput` skill variant: `{ type: "skill", name, path }`.
- Keep skill enable/disable management on the Capabilities page.
- Do not alter conversation rendering or unrelated Composer controls.
- Preserve disabled behavior while Composer mutations are pending.

## Review Focus

- A slash query filters commands and skills case-insensitively without hiding matching sections.
- Loading, error, empty, and no-match skill states remain understandable while commands still work.
- Selecting `/skill remaining text` removes only the slash token and preserves the remaining text.
- A selected skill is sent for send, steer, and queue modes with the expected input order.
- Removing the selected-skill chip restores normal text-only submission behavior.

### Task 1: Slash selection model

**Files:**
- Modify: `src/components/conversation/slash-command.ts`
- Test: `src/components/conversation/slash-command.test.ts`

**Interfaces:**
- Produces `selectSlashSkill(message: string, skill: Pick<v2.SkillMetadata, "name" | "path">): { message: string; skill: Pick<v2.SkillMetadata, "name" | "path"> }` for Composer.

- [x] Add failing tests for preserving text after a skill token and for an empty remainder.
- [x] Run `pnpm test -- src/components/conversation/slash-command.test.ts` and confirm the new tests fail.
- [x] Implement the pure helper without changing existing command selection behavior.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Vertical command and skill palette

**Files:**
- Modify: `src/components/conversation/SlashCommandPalette.tsx`
- Test: `src/components/conversation/SlashCommandPalette.test.tsx`
- Story: `src/components/conversation/SlashCommandPalette.stories.tsx`

**Interfaces:**
- Consumes `query`, `skills`, `skillsLoading`, `skillsError`, `onSelect`, and `onSelectSkill` props.
- Produces accessible vertical menu sections labelled Commands and Skills.

- [x] Add failing tests for vertical layout, case-insensitive filtering, skill selection, and loading/error/empty states.
- [x] Run the focused palette tests and confirm the new assertions fail.
- [x] Implement grouped vertical rows with skill name, description, and scope/path context; keep command rows disabled when requested.
- [x] Add populated, filtered, loading/error, empty, and disabled Ladle stories.
- [x] Re-run palette tests and confirm they pass.

### Task 3: Composer skill state and payloads

**Files:**
- Modify: `src/components/conversation/Composer.tsx`
- Test: `src/components/conversation/Composer.test.tsx`
- Story: `src/components/conversation/Composer.stories.tsx`

**Interfaces:**
- Uses `useSkillsList()` with the existing default query params.
- Sends selected skill inputs as `{ type: "skill", name, path }` before image/text inputs for send, steer, and queue.

- [x] Add failing tests for rendering matching skills, selecting/removing the chip, and sending the structured skill input.
- [x] Run the focused Composer tests and confirm the new assertions fail.
- [x] Fetch and flatten skills in Composer, pass palette state, render a removable selected-skill chip, and include the skill input in all submission modes.
- [x] Re-run Composer tests and confirm they pass.

### Task 4: Verification and handoff

**Files:**
- Modify: `docs/superpowers/specs/2026-11-09-slash-skill-selector-design.md` only if implementation decisions require clarification.
- Modify: `docs/superpowers/plans/2026-11-09-slash-skill-selector-plan.md` to mark completed steps.

- [x] Run `pnpm typecheck`.
- [x] Run `pnpm lint`.
- [x] Run `pnpm test`.
- [x] Run `pnpm check:catalog` and `pnpm ladle:build`.
- [x] Run `git diff --check`.
- [x] Commit the feature with a focused message.
