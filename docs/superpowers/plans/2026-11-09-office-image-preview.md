# Local Office Image Preview Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the local SVG preview command and conversation UI from XLSX to DOCX and PPTX.

**Architecture:** Reuse the native bounded SVG renderer and read OOXML text directly from ZIP entries. Reuse the existing frontend image component and explicit artifact-output metadata flow.

**Tech Stack:** Rust 2024, `calamine`, `zip`, `base64`, Tauri 2, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-office-image-preview-design.md`

## Constraints

- No Office/Python/Node/cloud/external renderer dependency.
- No AppServer, generated protocol, or server message changes.
- Never execute macros, relationships, external links, embedded objects, or media.
- Escape extracted XML text before inserting it into SVG.

### Task 1: Extend native preview extraction

**Files:** `src-tauri/src/artifact_preview.rs`

- [x] Add failing tests for minimal DOCX and PPTX ZIP packages, format acceptance, and XML-sensitive text.
- [x] Run focused tests and observe failure.
- [x] Implement bounded OOXML text extraction for DOCX paragraphs and PPTX slides.
- [x] Reuse SVG rendering and return the detected format in the preview payload.
- [ ] Run focused and full Rust tests; commit.

### Task 2: Extend frontend format support and documentation

**Files:** `src/platform/native.ts`, `src/components/conversation/ActivityItem.tsx`, `plugins/ruxex-artifacts/README.md`, `plugins/ruxex-artifacts/skills/ruxex-artifacts/SKILL.md`

- [x] Add frontend coverage for DOCX/PPTX preview metadata.
- [x] Extend the format union and render condition.
- [x] Document the supported image-preview formats and PDF boundary.
- [ ] Run focused/full frontend and package tests; commit.

### Task 3: Final verification and push

- [ ] Run Rust, frontend, Artifact SDK, package boundary, lint, build, and diff checks.
- [ ] Confirm AppServer/protocol paths are unchanged in this phase.
- [ ] Commit any documentation-only fix and push.
