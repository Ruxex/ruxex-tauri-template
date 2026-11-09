# Slash input skill selector design

## Intent

When the Composer starts with `/`, make command selection easier to scan by
stacking options vertically and expose installed skills in the same palette.
The palette should preserve the existing immediate commands (`Archive` and
`Compact`) and goal flow while allowing a selected skill to be sent as the
protocol's structured `skill` input.

## Goals

- Replace the horizontal slash-command row with a vertically stacked palette.
- Group built-in commands and skills so the distinction is obvious.
- Filter both groups by the current slash query.
- Show each skill's name and a compact description, with scope/path available
  as supporting context.
- Represent the selected skill as a removable chip in the Composer and send it
  together with the user's text/image input.
- Keep the existing disabled behavior while mutations are pending.

## Non-goals

- Do not change the existing command semantics for Archive, Compact, or Goal.
- Do not add skill enable/disable controls to the Composer; management remains
  on the Capabilities page.
- Do not change conversation rendering or server protocol payloads beyond using
  the existing `UserInput` skill variant.

## Approach

The selected approach is one vertical palette with two sections: Commands and
Skills. The current slash query filters both sections. A command selection keeps
its current behavior. A skill selection stores `{ name, path }` in Composer
state, clears the slash prefix, focuses the textarea, and renders a compact
chip with a remove action. On send/steer/queue, the skill input is included
before the text/image inputs; removing the chip returns the Composer to its
normal text-only behavior.

`useSkillsList()` supplies the installed skills. Loading, error, empty, and no
match states are shown inside the palette without blocking built-in commands.
The palette receives skills as props so its presentation remains independently
testable; Composer owns data fetching and submission state.

## Alternatives considered

- Separate `/skill` mode: clearer data boundary but adds an extra interaction
  and makes skills harder to discover.
- Horizontal scrolling: smaller code change but conflicts with the requested
  vertical selector and is harder to scan with descriptions.

## Acceptance criteria

- Slash input renders a vertical command/skill selector.
- Matching skills are visible with name and description.
- Selecting a skill creates a visible removable chip.
- Sending a message includes a structured `{ type: "skill", name, path }`
  input.
- Existing command and goal tests continue to pass.
- Story coverage includes populated, empty, loading/error, filtered, and
  selected-skill states.
