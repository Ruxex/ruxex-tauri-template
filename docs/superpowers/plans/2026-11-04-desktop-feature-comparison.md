# Desktop Feature Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create source-backed Japanese Markdown summaries for Codex Desktop and Claude Desktop, plus a Codex／Claude／Ruxex feature star matrix.

**Architecture:** Keep one product summary per file and one comparison file with shared, stable feature rows. Product files record official source URLs and conditions; the matrix cites those summaries and Ruxex repository evidence rather than repeating unsupported claims.

**Tech Stack:** Markdown, official web documentation links, repository README/AGENTS.md, `rg`, and Git diff checks.

**Spec:** `docs/superpowers/specs/2026-11-04-desktop-feature-comparison-design.md`

## Global Constraints

- Scope is desktop-app functionality documented by official Codex or Claude sources and publicly documented Ruxex Tauri Template capability boundaries.
- Research date is `2026-11-04`.
- Codex sources must be official OpenAI or ChatGPT documentation; Claude sources must be official Anthropic Help Center documentation.
- Ruxex claims must link to repository evidence or be marked `☆☆☆` when no evidence is available.
- Use the star rubric from the spec: `★★★`, `★★☆`, `★☆☆`, `☆☆☆`.
- Preserve OS, plan, beta, permission, local/cloud, and availability conditions beside the relevant feature.
- Do not modify application code or claim an unverified feature is absent from the whole product.

## Review Focus

- Source traceability: every product feature row has an official URL, and every Ruxex rating has a repository path or explicit no-evidence rationale.
- Scope boundaries: CLI, IDE, web-only, and generic model capabilities are not silently presented as desktop features.
- Availability qualifiers: macOS, Windows, Linux beta, paid plans, permissions, and local/cloud execution conditions remain visible.
- Row comparability: the matrix uses the same feature wording and categories for all three products.
- Rating semantics: stars describe documented desktop directness and evidence strength, not product quality or market superiority.

---

### Task 1: Codex Desktop feature summary

**Files:**
- Create: `docs/codex-desktop-features.md`
- Read: `docs/superpowers/specs/2026-11-04-desktop-feature-comparison-design.md`

**Interfaces:**
- Consumes: Codex source set in the spec, especially the current ChatGPT desktop app page, ChatGPT Work and Codex help article, Codex plan help article, and OpenAI Codex product posts.
- Produces: A Japanese feature catalog that the comparison matrix can cite by feature name and section.

- [x] **Step 1: Write the Codex summary structure**

  Create a Japanese Markdown document with the research date, scope, and a source-backed feature table. Cover the desktop app workspace and project/chat navigation, local folders and repositories, parallel agents and long-running work, files and artifacts, browser and Computer Use, plugins/skills, scheduled work, voice, code review and approvals, cloud/remote continuation, and platform/plan constraints.

- [x] **Step 2: Attach official evidence to every feature**

  Add the exact official source URL(s) in each feature row or subsection. Distinguish current app documentation from dated product announcements, and mark rollout or platform limitations rather than presenting them as universal availability.

- [x] **Step 3: Check the summary for scope and traceability**

  Run: `rg -n "https://|調査日|制約|機能" docs/codex-desktop-features.md`

  Expected: The file contains the research date, feature sections, conditions, and official URLs for each listed capability.

### Task 2: Claude Desktop feature summary

**Files:**
- Create: `docs/claude-desktop-features.md`
- Read: `docs/superpowers/specs/2026-11-04-desktop-feature-comparison-design.md`

**Interfaces:**
- Consumes: Claude Help Center source set in the spec, especially Install Claude Desktop, Get started with Claude Cowork, Quick Entry, and computer-use documentation.
- Produces: A Japanese feature catalog that the comparison matrix can cite by feature name and section.

- [x] **Step 1: Write the Claude summary structure**

  Create a Japanese Markdown document with the research date, scope, availability table, and source-backed feature sections. Cover Desktop Extensions, Cowork, local file access, long-running and parallel work, projects and shared memory, browser actions, Computer Use, generated professional outputs, scheduled tasks, Quick Entry, voice/dictation, and OS/plan limitations.

- [x] **Step 2: Attach official evidence to every feature**

  Link each feature to the official Help Center page that documents it. Preserve the distinction between Cowork cloud execution and desktop-mediated access to local files/browser/computer, and mark beta or paid-plan requirements.

- [x] **Step 3: Check the summary for scope and traceability**

  Run: `rg -n "https://|調査日|制約|機能" docs/claude-desktop-features.md`

  Expected: The file contains the research date, feature sections, conditions, and official URLs for each listed capability.

### Task 3: Codex／Claude／Ruxex feature matrix

**Files:**
- Create: `docs/codex-claude-ruxex-feature-matrix.md`
- Read: `README.md`
- Read: `AGENTS.md`
- Read: `docs/codex-desktop-features.md`
- Read: `docs/claude-desktop-features.md`

**Interfaces:**
- Consumes: The two product summaries plus Ruxex Tauri Template capability-boundary documentation.
- Produces: A comparable matrix with a legend, three product columns, short evidence notes, and Ruxex-specific source links.

- [x] **Step 1: Define shared comparison rows and rating legend**

  Use rows that can be evaluated for all products: desktop workspace, local files, projects/context, long-running work, parallel agents, browser actions, Computer Use, files/artifacts, integrations/extensions/plugins/MCP, scheduling, voice/visual context, code/developer workflows, approvals/permissions, cloud/remote continuation, and platform coverage. Include the spec’s four-level star legend and explain that ratings measure documented directness/evidence.

- [x] **Step 2: Fill the matrix from cited evidence**

  Give each cell one star rating and a concise reason. Link Codex and Claude cells to the corresponding summary sections or official URLs. Link Ruxex cells to `README.md`, `AGENTS.md`, or the exact public capability-boundary source; use `☆☆☆` plus “今回の確認範囲では根拠なし” when appropriate.

- [x] **Step 3: Add interpretation notes without ranking products**

  Add a short section describing where Ruxex has strong desktop building blocks, where the template is partial or adapter-backed, and which rows are not evidenced. Do not turn the table into a quality ranking or roadmap commitment.

### Task 4: Validate the documentation set

**Files:**
- Read: `docs/codex-desktop-features.md`
- Read: `docs/claude-desktop-features.md`
- Read: `docs/codex-claude-ruxex-feature-matrix.md`

- [x] **Step 1: Confirm all deliverables and required headings exist**

  Run: `test -f docs/codex-desktop-features.md && test -f docs/claude-desktop-features.md && test -f docs/codex-claude-ruxex-feature-matrix.md && rg -n "調査日|Sources|出典|★★★|★★☆|★☆☆|☆☆☆" docs/codex-desktop-features.md docs/claude-desktop-features.md docs/codex-claude-ruxex-feature-matrix.md`

  Expected: All three files exist and the output shows research/source and rating sections.

- [x] **Step 2: Check changed Markdown whitespace and inspect the diff**

  Run: `git diff --check && git diff -- docs/codex-desktop-features.md docs/claude-desktop-features.md docs/codex-claude-ruxex-feature-matrix.md`

  Expected: `git diff --check` exits successfully; the diff contains only the requested documentation files and no accidental code or generated state.

- [x] **Step 3: Check official URLs are present and reachable**

  Run a bounded URL check for the official URLs listed in the three Markdown files, or manually re-open each linked source if the environment does not provide a link checker.

  Expected: Each source link resolves to an OpenAI/ChatGPT or Anthropic/Claude official domain, and broken or redirected links are corrected before completion.
