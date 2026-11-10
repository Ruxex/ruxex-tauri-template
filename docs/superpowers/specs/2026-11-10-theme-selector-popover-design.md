# Theme selector popover

## Intent

Keep the Appearance page usable while the workspace side panel is open and
prevent the current theme preview from jumping downward when the preset list
opens.

## Goals

- Render the theme preset choices as an overlay, not normal-flow content.
- Keep the current theme preview in its original position while the choices are
  open.
- Place the open choices above the workspace side panel and its backdrop.
- Close the choices after selecting a preset.

## Non-goals

- Do not change the side panel's open/closed state.
- Do not change theme persistence, preset definitions, or preview content.
- Do not introduce a new portal or modal system for one settings control.

## Chosen approach

Keep the native `details` disclosure for accessibility and keyboard behavior,
but make the `details` container positioned and render its option panel as an
absolutely positioned popover. Give the open control a stacking level above
the existing workspace sidebar (`z-40`) and backdrop (`z-10`). Allow the
Interface settings panel to show the popover outside its normal bounds.

The existing preview remains a sibling in the flex row, so opening the
popover cannot change its layout position.

## Acceptance criteria

- Opening the theme selector leaves the current preview as a sibling outside
  the selector and does not add the option panel to normal flow.
- The option panel has a stacking class higher than the workspace sidebar and
  backdrop.
- Selecting a preset invokes the existing callback and closes the disclosure.
- Existing theme and settings tests remain green.
