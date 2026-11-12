---
name: visualize
description: Create safe, interactive HTML visualizations in Ruxex conversations when a visual materially improves the explanation.
---

# Ruxex Visualize

Use this skill when the user needs to see or explore a chart, graph, diagram, simulation, map, mockup, or other interactive visual in the conversation. Use ordinary Markdown for prose and tables when an interactive visual is not useful.

## Output contract

1. Create a self-contained HTML fragment in a local `.html` file.
2. Keep the file below 1 MiB.
3. Put the visualization reference on its own line in the assistant message:

```text
visualize{"path":"/absolute/path/to/visualization.html"}
```

Use wide mode for a full-width application mockup, waterfall, flame chart, stack trace, or dense side-by-side comparison:

```text
visualize{"path":"/absolute/path/to/visualization.html","mode":"wide"}
```

The only supported modes are `regular` and `wide`; omit `mode` for regular width. Keep the reference separate from explanatory Markdown.

## HTML requirements

- Make the fragment self-contained: inline HTML, CSS, SVG, and JavaScript are preferred.
- Use semantic HTML and accessible labels, keyboard-accessible controls, readable contrast, and responsive layout down to 320px.
- Do not require a server or a build step.
- Do not use `fetch`, XHR, WebSocket, navigation of the parent page, forms, popups, or direct access to the host application.
- Do not use `window.openai`, `window.openai.widgetState`, `window.openai.setWidgetState`, `window.openai.sendFollowUpMessage`, or any other host-specific bridge.
- Do not import scripts, styles, fonts, chart runtimes, or data from OpenAI-hosted URLs or any network origin. Do not use `persistent.oaistatic.com`.
- Do not put secrets, tokens, or private credentials in the file.
- Keep interactions local to the visualization. Use in-memory state; do not promise persistence between renders.

## Content guidance

Keep the fragment focused on the requested visual. Put short interpretation outside the file and do not duplicate the entire data set in prose. Prefer a small number of meaningful controls and a single dominant visual. Make important values available as text, not only through color or hover.

The Ruxex renderer loads the local file through Tauri, validates its path and size, wraps the fragment with a restrictive CSP, and displays it in a sandboxed iframe. A malformed, missing, oversized, or inaccessible file is shown as a safe error state rather than executed in the Ruxex page.
