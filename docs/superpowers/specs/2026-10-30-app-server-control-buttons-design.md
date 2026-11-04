# App Server Control Buttons Design

## Intent

Make App Server controls easier to distinguish and harder to activate by mistake.

## Design

Keep `Reconnect`, `Start`, `Restart`, and `Stop` in one responsive action row. Use semantic DaisyUI button variants: `btn-outline` for Reconnect, `btn-success` for Start, `btn-warning` for Restart, and `btn-error` for Stop. Preserve the existing labels, callbacks, disabled states, and App Server behavior.

## Non-goals

- No changes to App Server daemon actions or request handling.
- No changes to settings data, status rows, or responsive breakpoints beyond the shared action row.
