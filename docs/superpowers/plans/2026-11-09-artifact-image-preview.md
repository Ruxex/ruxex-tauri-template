# Local Artifact Image Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) to implement this plan task-by-task.

**Goal:** Render local XLSX artifacts as safe SVG images and show them in the Ruxex conversation UI without changing AppServer or protocol contracts.

**Architecture:** Add a native Rust renderer that reads bounded scalar XLSX data and returns a data URL through a Tauri command. Add a small frontend preview component and an explicit `artifactPath` metadata boundary in the conversation view model.

**Tech Stack:** Rust 2024, `calamine`, `base64`, Tauri 2 commands, React 19, TypeScript, Vitest/Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-09-artifact-image-preview-design.md`

## Global Constraints

- Do not change AppServer code, generated protocol types, or server message contracts.
- Do not require Office, Python, Node.js, cloud rendering, or external binaries at runtime.
- Render only canonical local XLSX files under approved Ruxex/workspace roots.
- Escape all workbook text before inserting it into SVG and cap file/cell/output sizes.
- Preserve existing conversation rendering when artifact metadata is absent.

## Review Focus

- A workbook containing XML-sensitive characters is rendered as text, never executable SVG markup — Task 1.
- Missing, outside-root, non-XLSX, oversized, and malformed files return structured errors — Task 1.
- Empty sheets and wide/long sheets remain bounded and render a useful image — Task 1.
- Activity items without artifact metadata are byte-for-byte behaviorally unchanged — Task 3.
- Preview loading/error states do not block the conversation timeline — Task 3.

### Task 1: Build the bounded native XLSX-to-SVG renderer

**Files:**
- Create: `src-tauri/src/artifact_preview.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml` only if needed
- Test: `src-tauri/src/artifact_preview.rs`

**Interfaces:**
- Produces `preview_artifact(path: String) -> CommandResult<ArtifactPreview>`.
- `ArtifactPreview` serializes as `mimeType`, `dataUrl`, `format`, `sheets`, `rows`, and `columns`.

- [ ] Write failing unit tests for SVG escaping, dimensions, empty sheets, and path/extension/size rejection.
- [ ] Run the focused Rust tests and verify the new tests fail for the missing module.
- [ ] Implement canonical path validation, calamine reading, bounded SVG layout, and data URL encoding.
- [ ] Register the Tauri command without changing AppServer/protocol modules.
- [ ] Run focused Rust tests and the artifact CLI/Rust suite.
- [ ] Commit the native renderer.

### Task 2: Add the frontend native bridge and preview component

**Files:**
- Modify: `src/platform/native.ts`
- Create: `src/components/conversation/ArtifactPreview.tsx`
- Create: `src/components/conversation/ArtifactPreview.test.tsx`
- Create: `src/components/conversation/ArtifactPreview.stories.tsx`

**Interfaces:**
- Consumes `previewArtifact(path)` from the Tauri bridge.
- Renders loading, image, error, and dimensions metadata without blocking parent activity.

- [ ] Write failing component tests for loading, success, and error states.
- [ ] Run focused tests and verify failure before implementation.
- [ ] Implement the bridge and accessible image preview.
- [ ] Run focused tests and the full frontend suite.
- [ ] Commit the bridge/component.

### Task 3: Connect explicit artifact metadata to conversation activities

**Files:**
- Modify: `src/components/conversation/conversation-model.ts`
- Modify: `src/components/conversation/ActivityItem.tsx`
- Modify: `src/components/conversation/ActivityItem.test.tsx`
- Modify: `src/components/conversation/ActivityItem.stories.tsx`

**Interfaces:**
- `ConversationViewItem` gains optional `artifactPath` and `artifactFormat` fields.
- Only normalized activity data that explicitly contains `artifactPath` produces a preview.

- [ ] Add failing tests for an artifact activity preview and unchanged non-artifact activity behavior.
- [ ] Run focused tests and verify failure.
- [ ] Normalize explicit artifact metadata and render `ArtifactPreview` alongside activity content.
- [ ] Run focused and full frontend tests.
- [ ] Commit the conversation integration.

### Task 4: Verify and document the preview boundary

**Files:**
- Modify: `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`
- Modify: `plugins/ruxex-artifacts/README.md` only if needed
- Modify: `.superpowers/sdd/2026-11-09-artifact-image-preview/progress.md`

- [ ] Document that generated XLSX paths can be previewed locally and that the renderer is image-oriented and bounded.
- [ ] Run frontend, Rust, artifact, packaging, and diff checks.
- [ ] Review changed paths for AppServer/protocol leakage.
- [ ] Commit documentation and push the completed preview phase.
