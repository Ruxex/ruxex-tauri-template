# Ruxex UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Ruxex-authored desktop UI string available in Japanese while retaining English source messages and the existing system/en/ja language preference.

**Architecture:** Initialize `i18next` and `react-i18next` with English and Japanese resources split by UI area. Synchronize the effective locale with `UiPreferencesProvider`, expose shared locale-aware formatters, and audit all Ruxex-authored UI surfaces, including desktop notifications and the Quick Panel title.

**Tech Stack:** React 19, TypeScript, `i18next`, `react-i18next`, `Intl`, Vitest, Tauri 2.

**Spec:** `docs/superpowers/specs/2026-11-16-ui-localization-design.md`

## Global Constraints

- Preserve the existing `UiLanguage` preference values and persistence format.
- Keep the English product copy as the source for translation keys.
- Do not modify generated protocol files.
- Translate Ruxex-authored UI copy; keep user-authored chat content, model or App Server output, plugin and provider names, skill content, shell output, file paths, source code, API values, and protocol identifiers unchanged.
- Resolve `system` to Japanese when the system language starts with `ja`; otherwise use English.
- Preserve configured product branding and proper names such as `Ruxex`; localize generic native window-title wording.
- Localize dates, times, counts, and numbers with the resolved UI locale without changing schedule time-zone semantics.
- Keep the normal Tauri capability identifier `default`; add only the minimum permission needed to localize the Quick Panel title.
- Preserve unrelated workspace changes. Do not commit because this shared checkout already contains unrelated modifications.

## Review Focus

- **Language changes while the app is open:** React copy, `<html lang>`, and native Quick Panel title use one effective language. Test by changing `system`/`en`/`ja` preferences and asserting all three.
- **Unsupported system languages:** Resolve to English and keep the locale catalogs usable. Test `navigator.language` values `ja-JP`, `en-US`, and an unsupported locale.
- **Catalog drift:** Missing, extra, or empty Japanese messages fail checks. Test a representative nested namespace and the full catalog parity checker.
- **Dynamic messages and external errors:** Interpolated Ruxex framing is translated while opaque App Server/model text and protocol status values remain intact. Test a notification and a stable application error code.
- **Japanese text fit and native runtime boundaries:** Long labels remain operable and Quick Panel localization works only in the Tauri runtime. Test a long Japanese label and the browser-runtime fallback; capture representative fixtures.

---

### Task 1: Add the localization runtime and complete-catalog checks

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `src/app/i18n.ts`, `src/app/providers.tsx`, `src/app/providers.test.tsx`, `src/test-setup.ts`
- Create: `src/locales/en/*.json`, `src/locales/ja/*.json`
- Create: `src/app/i18n.test.ts`
- Create: `scripts/check-i18n-catalogs.mjs`
- Modify: `package.json` (add `check:i18n` script)

**Interfaces:**
- Produces `i18n`, an initialized i18next instance with `en` and `ja` resources and UI-area namespaces.
- Produces `resolveUiLanguage(language: UiLanguage, systemLanguage?: string): "en" | "ja"`.
- Produces `uiLocale(language: UiLanguage): "en" | "ja"` for `Intl` formatting.
- Produces `useTranslation(namespace)` through `react-i18next`; non-React modules may call `i18n.t` with an explicit namespace.

- [ ] **Step 1: Write failing tests** for language resolution, default English, Japanese selection, `system` detection, and all catalog key parity/non-empty Japanese messages.
- [ ] **Step 2: Run** `pnpm vitest run src/app/i18n.test.ts`; expect the missing resolver/catalog checks to fail.
- [ ] **Step 3: Add i18next resources, initialization, provider integration, and catalog validation.** Add `check:i18n` to package scripts and keep all locale keys namespaced and stable.
- [ ] **Step 4: Run** `pnpm vitest run src/app/i18n.test.ts` and `pnpm check:i18n`; expect both to pass.

### Task 2: Synchronize preferences and localize the shared application shell

**Files:**
- Modify: `src/app/ui-preferences.ts`, `src/app/ui-preferences.test.ts`, `src/app/ui-preferences.test.tsx`
- Modify: `src/components/layout/BrowserNavigationBar.tsx`, `src/components/layout/BrowserNavigationBar.test.tsx`
- Modify: `src/components/layout/AppLayout.tsx`, `src/components/layout/AppLayout.test.tsx`
- Modify: `src/components/sidebar/**/*.tsx`
- Modify: `src/components/common/**/*.tsx`
- Modify: `src/components/settings/**/*.tsx`
- Modify: `src/pages/SettingsOverviewPage.tsx`, `src/pages/SettingsOverviewPage.test.tsx`
- Modify: `src/pages/SettingsPage.tsx`, `src/pages/AppearancePage.tsx`, `src/pages/AccountPage.tsx`, `src/pages/VersionPage.tsx`, and their tests
- Modify: English and Japanese `common`, `navigation`, and `settings` resources

**Interfaces:** Consumes `resolveUiLanguage`, resources, and `I18nextProvider` from Task 1. Preference changes update i18next and `document.documentElement.lang` from the same effective language; `languagechange` is observed while `system` is selected.

- [ ] **Step 1: Write failing tests** for persisted `ja`, live language changes, `languagechange` while `system` is selected, Japanese document language, navigation labels, and settings labels/accessibility names.
- [ ] **Step 2: Run** `pnpm vitest run src/app/ui-preferences.test.ts src/app/ui-preferences.test.tsx src/app/branding.test.tsx src/components/layout/BrowserNavigationBar.test.tsx src/components/layout/AppLayout.test.tsx src/components/settings src/pages/SettingsOverviewPage.test.tsx`; expect new locale assertions to fail.
- [ ] **Step 3: Migrate shell, shared controls, settings, and page titles to namespaced translation keys.** Preserve native language names in the language selector.
- [ ] **Step 4: Run the same command** and verify language switching updates visible strings without reloading.

### Task 3: Localize home, project, chat-list, archive, and conversation surfaces

**Files:**
- Modify: `src/pages/HomePage.tsx`, `src/pages/ChatsPage.tsx`, `src/pages/ProjectsPage.tsx`, `src/pages/ProjectHomePage.tsx`, `src/pages/ArchivePage.tsx`, and their tests
- Modify: `src/components/chat/**/*.tsx`, `src/components/chats/**/*.tsx`, `src/components/projects/**/*.tsx`
- Modify: `src/components/conversation/**/*.tsx`
- Modify: `src/components/thread-summary/**/*.tsx`
- Modify: `src/components/activity/**/*.tsx`, `src/components/approvals/**/*.tsx`
- Modify: English and Japanese `chats`, `projects`, `conversation`, `activity`, and `approvals` resources

**Interfaces:** Uses `useTranslation` and shared locale formatting from Tasks 1–2. All Ruxex-owned labels, tooltips, prompts, empty states, statuses, dialogs, and accessible names are localized; chat and model content remain source text.

- [ ] **Step 1: Add failing Japanese route tests** for home, chat list, project list/detail, archive, active conversation, approval, and activity surfaces. Include accessible names and dialog actions.
- [ ] **Step 2: Run** the affected Vitest files; expect untranslated route assertions to fail.
- [ ] **Step 3: Migrate the listed route and component surfaces** using full messages with named interpolation values and i18next plural keys for counts.
- [ ] **Step 4: Run affected tests** and confirm user-authored/model text remains unchanged while Ruxex-authored framing is Japanese.

### Task 4: Localize capabilities, providers, automation, and system feedback

**Files:**
- Modify: remaining `src/pages/**/*.tsx` not covered by Tasks 2–3, including `AppServerPage`, `HooksPage`, `CapabilitiesPage`, `PluginDetailPage`, `MarketplaceSettingsPage`, `McpServersPage`, `ModelPage`, `SchedulesPage`, and `ScheduleDetailPage`, plus their tests
- Modify: `src/pages/capabilities/**/*.tsx`, `src/pages/mcp-servers/**/*.tsx`, `src/pages/schedules/**/*.tsx`
- Modify: `src/components/capabilities/**/*.tsx`, `src/components/mcp/**/*.tsx`, `src/components/plugins/**/*.tsx`, `src/components/terminal/**/*.tsx`, `src/components/git-diff/**/*.tsx`
- Modify: `src/app/error-message.ts`, `src/app/error-message.test.ts`
- Modify: `src/platform/notifications.ts`, `src/platform/notifications.test.ts`
- Modify: app-server hooks that emit Ruxex-authored UI messages and their tests
- Modify: English and Japanese `capabilities`, `plugins`, `mcp`, `schedules`, and `errors` resources

**Interfaces:** Non-React feedback uses initialized `i18n.t` with an explicit namespace and language. Stable app error codes map to localized messages; arbitrary server text stays unchanged. Notification classification accepts the effective language or a translation function so Ruxex-owned titles and body templates are localized.

- [ ] **Step 1: Write failing tests** for Japanese capability/plugin/settings routes, application error-code mapping, and notification titles/body templates with server-provided details preserved.
- [ ] **Step 2: Run** affected page, notification, and error tests; expect new localization assertions to fail.
- [ ] **Step 3: Migrate the listed integration pages and system feedback** while retaining external names, status values, paths, and server messages verbatim.
- [ ] **Step 4: Run affected tests** and verify provider-specific details remain intact.

### Task 5: Apply locale-aware date, time, and number formatting

**Files:**
- Create: `src/app/locale-format.ts`, `src/app/locale-format.test.ts`
- Modify: `src/pages/schedules/schedule-format.ts` and tests
- Modify: `src/pages/schedules/ScheduleCard.tsx`, `src/pages/ScheduleDetailPage.tsx`, and their tests
- Modify: `src/components/chats/ChatListItem.tsx` and tests
- Modify: `src/components/conversation/ConversationItem.tsx` and tests
- Modify: `src/components/thread-summary/TokenUsageSection.tsx` and tests
- Modify: `src/pages/HooksPage.tsx` and tests
- Modify: other formatters found by `rg -n 'toLocale|Intl\\.' src --glob '*.{ts,tsx}' --glob '!*.test.*'`

**Interfaces:** `locale-format.ts` exports small `Intl.DateTimeFormat`, `Intl.NumberFormat`, and relative-time helpers that take an explicit resolved locale. No formatter silently depends on browser default locale or hard-coded `en-US` when formatting UI values.

- [ ] **Step 1: Write failing tests** proving `ja` uses Japanese numeric/date formatting and `en` preserves English formatting, including compact token counts.
- [ ] **Step 2: Run** `pnpm vitest run src/app/locale-format.test.ts` and affected formatter tests; expect missing locale behavior to fail.
- [ ] **Step 3: Migrate all user-facing `Intl` and `toLocale*` call sites** to the shared locale helpers without changing timezone or stored data values.
- [ ] **Step 4: Run affected formatter tests** and assert exact Japanese and English output.

### Task 6: Localize the native Quick Panel title

**Files:**
- Modify: `src/components/quick-panel/QuickPanelPage.tsx`, `src/components/quick-panel/QuickPanelPage.test.tsx`
- Modify: `src-tauri/capabilities/default.json`
- Modify: English and Japanese `common` and `quickPanel` resources

**Interfaces:** Uses resolved locale from Tasks 1–2. Keep configured product branding intact; translate the Quick Panel's generic window-title wording. Set the Tauri current webview title only in native desktop runtime and update it when the selected language changes. Keep the main `Ruxex Desktop` branding title unchanged.

- [ ] **Step 1: Write failing tests** for the Japanese Quick Panel native title, live preference changes, and no Tauri window API call in browser runtime.
- [ ] **Step 2: Run** `pnpm vitest run src/components/quick-panel/QuickPanelPage.test.tsx`; expect title tests to fail.
- [ ] **Step 3: Set the localized Quick Panel title** using the Tauri window API and add only `core:window:allow-set-title` to the existing `default` capability if required.
- [ ] **Step 4: Run the targeted tests** and verify the default capability still applies only to `main` and `quick-panel`.

### Task 7: Complete the untranslated-string audit and UI verification

**Files:**
- Modify: remaining Ruxex-owned product UI source files identified by the audit
- Modify: translation resource JSON files and catalog checks
- Modify: `src/app/router.test.tsx` or add `src/app/localization.test.tsx`
- Create: `fixtures/dummy-home/japanese-ui.spec.ts`
- Modify: `Makefile` (`ui-fixtures` target)

**Interfaces:** Consumes all earlier namespace and locale APIs. No product UI route may contain untranslated Ruxex-authored user-facing copy in Japanese mode; external content and proper names retain their original text.

- [ ] **Step 1: Run the final source audit** over `src/app`, `src/components`, `src/pages`, `src/platform`, and app-server UI feedback. Classify remaining literals as translated UI, proper names, protocol identifiers, user/server content, or developer-only text.
- [ ] **Step 2: Write failing smoke tests** for representative Japanese routes and catalog completeness across every namespace.
- [ ] **Step 3: Translate any remaining Ruxex-owned strings** and correct truncation/overflow found in Japanese fixtures.
- [ ] **Step 4: Run** `pnpm check:i18n`, `make check-tests`, and `make build`.
- [ ] **Step 5: Extend `ui-fixtures` with `japanese-ui.spec.ts`,** which selects Japanese in Settings and captures representative home, project, chat, and settings surfaces. Run `make ui-fixtures`; inspect Japanese screenshots for clipping, truncation, and accessible label regressions. Report any environment-specific fixture failure with its captured artifact path.
- [ ] **Step 6: Run** `git diff --check` and inspect only the task's final diff, preserving unrelated modifications.
