# Tauri E2E Fixture Input Stability

## Intent

Make UI fixture screenshots less sensitive to transient rendering state by
waiting 300 ms immediately before and immediately after each screenshot. Also
disable automatic first-character capitalization for all application input
fields, including editable composer content.

## Goals

- Apply the 300 ms pre/post delay to every UI-fixture screenshot helper.
- Apply one app-wide `autocapitalize="none"` setting so current and future
  native inputs and editable content inherit the same behavior.
- Keep the change dependency-free and preserve existing fixture call sites.

## Non-goals

- Changing screenshot names, fixture scenarios, or screenshot dimensions.
- Manually adding capitalization props to every individual field.
- Changing capitalization of display text or submitted values.

## Constraints

- The fixture helpers are in `fixtures/dummy-home/support.ts` and
  `fixtures/marketplace-home/support.ts`.
- The delay value is exactly 300 ms (0.3 seconds) on both sides of the
  screenshot call.
- The input behavior must cover `<input>`, `<textarea>`, and the Milkdown
  `contenteditable` composer without requiring every component to be edited.

## Approaches

- **Chosen: app-wide inherited setting plus helper delays.** Add
  `autocapitalize="none"` to the document root and add `browser.pause(300)`
  before and after `browser.saveScreenshot` in both helpers. This covers all
  existing and future fields with minimal duplication.
- **Rejected: per-field props.** Explicitly adding `autoCapitalize="none"`
  to every field is more verbose and can miss newly added fields.

## Verification

Add focused tests that assert each fixture screenshot helper pauses for 300 ms
before and after saving, then run the fixture support tests plus the project's
typecheck, lint, and unit-test commands.
