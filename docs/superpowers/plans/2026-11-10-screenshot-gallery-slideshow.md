# Screenshot Gallery Slideshow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make screenshot cards open an in-page, touch-swipable slideshow starting from the clicked image.

**Architecture:** Keep the existing Python-generated gallery and static image URLs. Generate one native `<dialog>` per gallery document, attach each group's image metadata to its cards, and use a small inline script to manage the selected group/index, keyboard controls, wraparound navigation, and pointer swipes.

**Tech Stack:** Python standard library, generated HTML/CSS, browser-native dialog and pointer events, Python `unittest`.

**Spec:** `docs/superpowers/specs/2026-11-10-screenshot-gallery-slideshow-design.md`

## Global Constraints

- Clicking a screenshot card opens an in-page slideshow rather than a new image page or tab.
- The first slide is the clicked image.
- Navigation is limited to the clicked card's page group.
- Previous/next controls, left/right keyboard arrows, and touch swipes move between slides; navigation wraps at both ends.
- Escape and the close control return to the gallery overview.
- No third-party JavaScript dependency is added.

## Review Focus

- Group isolation: navigating from one page group must not show images from another group.
- Start position: clicking a non-first card must render that exact card first.
- Boundary navigation: previous from the first and next from the last wrap correctly.
- Gesture direction: horizontal pointer movement selects the correct adjacent image while vertical movement is ignored.
- Empty gallery: the generated dialog/script must remain valid when there are no images.

### Task 1: Generate and test the slideshow gallery

**Files:**
- Modify: `.local-dev/screenshot-gallery/server.py`
- Modify: `.local-dev/screenshot-gallery/test_server.py`
- Modify: `.local-dev/screenshot-gallery/README.md`

**Interfaces:**
- Consumes: existing `group_images`, `image_card`, and `build_gallery_document` output.
- Produces: gallery HTML with slideshow cards, a native dialog, and inline slideshow controls.

- [x] **Step 1: Add failing gallery document tests**

  Extend `test_server.py` with assertions that cards no longer target image
  files directly, each card includes a slideshow group/index, the document has
  a dialog with previous/next/close controls, and the script contains start,
  wraparound, keyboard, and pointer-swipe handling markers.

- [x] **Step 2: Run the gallery tests and verify the new assertions fail**

  Run: `python3 -m unittest discover -s .local-dev/screenshot-gallery -p 'test_*.py' -v`

  Expected: FAIL because cards currently link directly to image files and the
  gallery has no dialog or slideshow script.

- [x] **Step 3: Implement the generated slideshow**

  Change `image_card` to emit a button-like link with the group identifier and
  zero-based card index. In `build_gallery_document`, create stable serialized
  group data for each page section, add one accessible `<dialog>` viewer, and
  include inline JavaScript that opens at the clicked index, renders image
  metadata, wraps previous/next navigation, handles Escape/arrow keys, and
  treats horizontal pointer swipes as navigation. Preserve direct static image
  serving and the existing page-group ordering. Update the README to document
  the slideshow controls.

- [x] **Step 4: Run the gallery tests and verify they pass**

  Run: `python3 -m unittest discover -s .local-dev/screenshot-gallery -p 'test_*.py' -v`

  Expected: all gallery tests pass.

- [x] **Step 5: Run formatting and repository verification**

  Run: `make fmt-check && git diff --check && make verify`

  Expected: formatting, typecheck, lint, frontend tests, Python tests, and
  production build pass with exit code 0.

- [x] **Step 6: Keep the local-only implementation in `.local-dev/` uncommitted**

  The screenshot gallery source and README are intentionally ignored by the
  repository's `.gitignore`; this task changes the shared local viewer without
  force-adding the local-only development tool to version control.

### Task 2: Make the slideshow global and viewport-first

**Files:**
- Modify: `.local-dev/screenshot-gallery/server.py`
- Modify: `.local-dev/screenshot-gallery/test_server.py`
- Modify: `.local-dev/screenshot-gallery/README.md`

**Interfaces:**
- Consumes: the existing page-group rendering order and slideshow dialog.
- Produces: one global slideshow index and a viewport-maximized viewer.

- [x] **Step 1: Add failing tests for cross-page navigation and viewport sizing**

  Assert that all rendered cards use one global index sequence across page
  groups, the script uses one flat `slideshowImages` list and
  `openSlideshow(index)`, and the dialog/stage CSS uses the viewport with
  minimal outer margins.

- [x] **Step 2: Run the gallery tests and verify the new assertions fail**

  Run: `python3 -m unittest discover -s .local-dev/screenshot-gallery -p 'test_*.py' -v`

  Expected: FAIL because the current document still serializes separate groups
  and uses a constrained dialog with group-scoped navigation.

- [x] **Step 3: Flatten slideshow data and maximize the viewer**

  Build one image list in the same order as the page sections, assign each card
  its global index, and update the inline script to navigate that flat list.
  Reduce dialog padding/margins, use near-full viewport dimensions, and size
  the image from the available dynamic viewport while retaining compact
  controls and caption space. Update the README wording to describe global
  navigation.

- [x] **Step 4: Run the gallery tests and verify they pass**

  Run: `python3 -m unittest discover -s .local-dev/screenshot-gallery -p 'test_*.py' -v`

  Expected: all gallery tests pass.

- [x] **Step 5: Run final verification and reload the local host**

  Run: `python3 -m py_compile .local-dev/screenshot-gallery/server.py && make fmt-check && git diff --check && make verify`

  Expected: all checks pass with exit code 0; restart the screenshot gallery and
  verify the served HTML contains the global slideshow markers.

  ```bash
  git add docs/superpowers/specs/2026-11-10-screenshot-gallery-slideshow-design.md \
    docs/superpowers/plans/2026-11-10-screenshot-gallery-slideshow.md \
    .local-dev/screenshot-gallery/server.py \
    .local-dev/screenshot-gallery/test_server.py \
    .local-dev/screenshot-gallery/README.md
  git commit -m "feat(dev): add screenshot gallery slideshow"
  ```
