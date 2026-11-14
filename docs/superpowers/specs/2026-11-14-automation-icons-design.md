# Automation Appearance Design

## Goal

Allow each automation schedule to choose and display an icon and color using the same fixed catalog and rendering style as projects.

## Design

- Reuse the 16 project icon options, 16 project color options, `ProjectIcon` renderer, and project metadata picker.
- New schedules start with the project defaults: folder icon and blue color.
- Store selected values as required `icon` and `color` fields on schedule input and records, serialized in `schedules.json`.
- Add icon and color selection to schedule creation and editing, preserving both values when editing.
- Display each selected icon using its selected color on schedule cards and recent automation runs in the sidebar.
- Keep disabled schedule items visually muted, including their configured icon.
- Do not migrate or default appearance values for existing schedule files; backward compatibility is not required.

## Out of Scope

- Custom image uploads or a separate automation-only icon/color catalog.
