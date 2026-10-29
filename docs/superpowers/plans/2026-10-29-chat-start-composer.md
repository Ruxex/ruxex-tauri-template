# Chat Start Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan.

## Goal

Unify the Let’s get started composer with the active chat composer and remove
the dedicated New task page while preserving legacy routes.

## Tasks

1. Update page, navigation, and app-server flow tests to assert the canonical
   `/` start screen, shared control labels, project query preservation, and
   legacy-route redirection behavior. Run the focused tests and confirm they
   fail for the current implementation.
2. Simplify `NewChatComposer` to the start-screen-only flow, reuse
   `ComposerOptions`, `PermissionMenu`, and `ComposerSettings`, and implement
   Goal/Plan mode behavior for the initial thread.
3. Make `HomePage` read an optional project query parameter, route legacy
   new-chat URLs to it, and update all New task/New chat links to the canonical
   route. Remove `NewChatPage` and its obsolete form tests.
4. Run the full test, typecheck, lint, formatting, and diff checks; review the
   final diff for accidental changes; commit and push the completed change.

## Verification

- Focused page/composer/app-server tests pass.
- Full Vitest suite passes.
- TypeScript, Biome, ESLint, and diff checks pass.
