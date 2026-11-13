# Hide the global sidebar toggle when no pane is available Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the global header's left-pane toggle on routes where the context pane is unavailable.

**Architecture:** Reuse `AppLayout`'s existing `hidesContextPanel` condition to make `onToggleSidebar` optional at the call site. `BrowserNavigationBar` already renders its toggle only when the callback exists.

**Tech Stack:** React, TypeScript, React Router.

**Spec:** `docs/superpowers/specs/2026-11-13-hide-sidebar-toggle-without-pane-design.md`

## Global Constraints

- Keep existing pane visibility and preference behavior unchanged.
- Do not change right-pane controls.

## Review Focus

- Projects, Account, and Approvals must hide the header's left-pane toggle.
- Routes with a context pane must retain the toggle.
- Right-pane toggle visibility and behavior must be unchanged.

---

### Task 1: Connect left-pane toggle availability to pane visibility

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: Existing `hidesContextPanel` boolean and optional `BrowserNavigationBar.onToggleSidebar` callback.
- Produces: The callback is passed only when `hidesContextPanel` is false.

- [ ] **Step 1: Update the `BrowserNavigationBar` call site**

In `AppLayout.tsx`, conditionally pass the existing sidebar-toggle callback only when `hidesContextPanel` is false. Do not change the callback body or other props.

- [ ] **Step 2: Review the resulting diff**

Confirm the toggle callback is absent for Projects, Account, and Approvals and remains present on other routes; confirm the right-pane props are untouched.

No automated tests are added or run for this request.
