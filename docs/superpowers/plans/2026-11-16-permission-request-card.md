# Permission Request Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make permission requests in conversation easier to scan and resolve, following the approved Codex approval reference.

**Architecture:** Refine the existing permission-specific rendering in `ServerRequestCard`. Preserve protocol responses and all non-permission server request variants.

**Tech Stack:** React, TypeScript, Tailwind utility classes, DaisyUI theme tokens.

**Spec:** `docs/superpowers/specs/2026-11-16-permission-request-card-design.md`

## Global Constraints

- Colors, radius, spacing, and typography follow the existing theme and workbench patterns.
- Long access paths remain readable; do not truncate away their values.
- Preserve accessible headings and action names.
- Reuse existing data and actions; update only the UI needed for this visual change.

## Review Focus

- Long paths — remain fully available and readable through wrapping or detail treatment.
- Empty or missing reason — access summary remains understandable without an empty gap.
- Disconnected or non-actionable request — controls stay disabled/hidden as today.
- Permission request with only network or only filesystem access — summary remains correct.
- Other request types — keep their existing card and action layout.

---

### Task 1: Refine the permission request card

**Files:**
- Modify: `src/components/approvals/ServerRequestCard.tsx`

**Interfaces:**
- Consumes: Existing `PendingServerRequest`, permission summary, and resolution handlers.
- Produces: Permission-specific content hierarchy and vertically stacked decision controls; no protocol changes.

- [x] Review the current permission section and button state logic in `ServerRequestCard.tsx`.
- [x] Refine the header, reason, and access scope into distinct readable groups using existing theme tokens; ensure long paths wrap instead of truncating.
- [x] Stack “Approve once”, “Approve in this chat”, and “Reject” vertically in the card footer, retaining their existing handlers and disabled-state behavior.
- [x] Inspect the rendered card at the app’s desktop width and a narrow window width; adjust only visible layout issues.
- [x] Run `git diff --check` and inspect the final diff for scope and accessibility regressions.
