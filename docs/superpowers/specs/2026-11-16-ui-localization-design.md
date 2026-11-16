# Ruxex UI Localization Design

## Intent

Ruxex currently stores a language preference (`system`, `en`, or `ja`) and sets
the document language, but only one application message uses the translation
helper. Make the full Ruxex-owned desktop UI available in Japanese while
keeping English as the source locale and preserving the existing language
choices for later locales.

## Goals

- Translate all Ruxex-authored UI copy into Japanese: navigation, settings,
  chat controls, projects, dialogs, notifications, errors, empty and loading
  states, tooltips, placeholders, accessible names, status text, and native
  window titles such as the Quick Panel title.
- Keep English as the default source catalog and preserve `system`, `en`, and
  `ja` preference behavior.
- Resolve `system` from the OS/browser locale, falling back to English when the
  detected language is not supported.
- Localize user-facing dates, times, counts, and numbers using the resolved UI
  locale. Keep scheduling time-zone semantics unchanged.
- Detect missing, extra, or empty Japanese messages in automated checks.
- Keep protocol behavior, data, and external content unchanged.

## Non-goals

- Translate user-authored chat content, model or App Server output, plugin and
  provider names, skill content, shell output, file paths, source code, API
  values, or protocol-defined identifiers.
- Add another translated locale in this change.
- Translate generated protocol sources, fixture data, test-only copy, or
  developer documentation.
- Change feature behavior, terminology required by external protocols, or the
  product's visual design beyond layout adjustments needed for Japanese text.
- Preserve configured product branding and proper names such as `Ruxex`; localize
  generic native window-title wording.

## Constraints

- Preserve the existing `UiLanguage` preference values and persistence format.
- Keep the English product copy as the source for translation keys.
- Keep provider-specific errors and protocol values behind their current
  boundaries. Translate Ruxex-authored error framing while retaining opaque
  server-provided details unless a stable error code has an explicit localized
  message.
- Do not modify generated protocol files.
- The current application has no `i18next` or `react-i18next` dependency.
- UI strings are spread across roughly 257 non-test files in app, component,
  page, platform, and app-server code; migration is broad and must be audited
  by surface, not limited to the settings language picker.

## Approaches

1. **`i18next` and `react-i18next` (selected):** Use established resource
   namespaces, React hooks, interpolation, and plural handling. It adds two
   dependencies and requires migrating the UI copy, but provides a standard
   path for future locales and avoids building message infrastructure in-house.
2. **Extend the existing custom translator:** Keep the bundle and dependency
   surface smaller, but implement namespaces, interpolation, plurals, locale
   formatting, and catalog checks locally. This increases long-term
   maintenance and makes translation workflows less standard.

The user selected the first approach and the full Ruxex UI scope. Japanese is
the only new translation; English remains the source catalog and fallback.

## Design

- Add `i18next` and `react-i18next`; initialize resources before rendering the
  router and expose the configured instance through `I18nextProvider`.
- Organize resources by UI area (for example, `common`, `navigation`,
  `settings`, `chats`, `projects`, `capabilities`, `schedules`, and
  `conversation`). Use stable namespaced keys rather than English copy as keys.
- Keep both `en` and `ja` catalogs structurally aligned. A test checks key
  parity and rejects empty Japanese translations. Product components use
  `useTranslation` or a small shared translation adapter; non-React UI
  notifications use the same initialized instance.
- Synchronize the effective language with `UiPreferencesProvider`: map
  `system` to Japanese for `navigator.language` values beginning with `ja`,
  otherwise English; call `changeLanguage` when the preference or detected
  locale changes; set `document.documentElement.lang` from the same resolved
  value.
- Replace all Ruxex-owned rendered English literals, including accessible
  labels and error wrappers. Use complete messages with named interpolation
  values instead of concatenating translated sentence fragments. Use locale
  plural rules through i18next for count-dependent messages.
- Localize native window titles from the resolved language after the UI
  preference is available. Keep the Quick Panel title in sync with the
  language preference and add only the Tauri window-title permission needed by
  the default capability if the frontend API requires it. Preserve the main
  `Ruxex Desktop` product branding title.
- Format dates, times, numbers, and compact token counts with `Intl` using the
  resolved locale rather than browser-default or hard-coded `en-US` formatters.
  Preserve existing time-zone and schedule data semantics.
- Keep server-generated message bodies, model output, paths, provider names,
  and protocol terms as provided. Translate stable application error codes and
  Ruxex-authored framing, not arbitrary error text.
- Audit product routes and shared controls in Japanese, including responsive
  layouts and accessible names. Add localization smoke tests for key routes
  and dynamic messages, alongside catalog completeness checks.

## Verification

- Type-check and lint the application.
- Run unit tests, including catalog parity, language-resolution, route-level
  Japanese coverage, dynamic placeholders/plurals, and locale-aware formatting.
- Build the app and inspect representative Japanese UI fixture screenshots for
  clipping, truncation, and overflow.
- Review the final untranslated-string inventory and preserve unrelated
  workspace changes.

## Open to the builder

- Choose the exact namespace boundaries based on the existing component and
  page structure.
- Choose a small adapter for non-React translation and `Intl` formatter access
  if direct i18next calls would make call sites harder to test.
- Translate concise Japanese UI copy consistently with the existing Ruxex
  terminology, while retaining protocol-mandated English terms.
