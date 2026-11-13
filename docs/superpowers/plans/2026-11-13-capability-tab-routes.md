# Distinct capability routes and breadcrumbs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Plugins, Skills, and MCP distinct URLs and accurate global breadcrumbs.

**Architecture:** Reuse `CapabilitiesPage` for the three canonical routes and select its section from the path. Remove the old `/capabilities` query-tab route. Update the sidebar and breadcrumb resolver to use the canonical paths.

**Tech Stack:** React, TypeScript, React Router.

**Spec:** `docs/superpowers/specs/2026-11-13-capability-tab-routes-design.md`

## Global Constraints

- Keep plugin detail URLs and capability content unchanged.
- Do not keep the legacy `/capabilities?tab=...` route.

## Review Focus

- `/capabilities/plugins`, `/capabilities/skills`, and `/capabilities/mcp` select and display the matching section.
- Breadcrumbs show Plugins, Skills, or MCP for the corresponding page.
- Plugin detail breadcrumbs link back to the Plugins list.
- The legacy `/capabilities` route and query tabs are not registered or interpreted.

---

### Task 1: Add canonical capability section routes

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/pages/CapabilitiesPage.tsx`
- Modify: `src/components/sidebar/PluginsSidebar.tsx`
- Modify: `src/components/sidebar/PluginsSidebar.test.tsx` (move the existing Skills sidebar case to its canonical path)
- Modify: `src/components/sidebar/navigation.ts`
- Modify: `src/components/sidebar/navigation.test.ts` (use the canonical Plugins path)
- Modify: `src/components/layout/BrowserNavigationBar.tsx`
- Modify: `src/components/layout/BrowserNavigationBar.test.tsx` (update the plugin detail breadcrumb target)
- Modify: `src/pages/CapabilitiesPage.test.tsx` (move the existing Skills and MCP cases to their canonical paths)

**Interfaces:**
- Consumes: Existing `CapabilitiesPage`, capability sidebar links, and breadcrumb resolver.
- Produces: Canonical section paths `/capabilities/plugins`, `/capabilities/skills`, `/capabilities/mcp`; legacy query selection remains supported.

- [ ] **Step 1: Register section routes**

Render `CapabilitiesPage` on each canonical section path and retain the plugin detail route. Remove the base `/capabilities` route.

- [ ] **Step 2: Select the content from the route**

In `CapabilitiesPage`, select Plugins, Skills, or MCP from the canonical pathname.

- [ ] **Step 3: Navigate the sidebar to canonical paths**

Point each capability section button to its canonical path and select the active item from that path.

- [ ] **Step 4: Resolve breadcrumbs by section**

Show the matching section name on each canonical route. Link plugin detail breadcrumbs to `/capabilities/plugins`.

- [ ] **Step 5: Review the resulting diff**

Check each route, sidebar path, and breadcrumb target against the spec. Do not add or run tests for this request.
