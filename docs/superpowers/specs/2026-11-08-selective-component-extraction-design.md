# Selective Component Extraction Design

## Intent

Make the UI component boundaries clearer without turning tightly coupled page logic into a collection of one-off files. The extraction is limited to presentational pieces that have an independent contract and are useful in the component catalog.

## Approaches

1. Split every private JSX helper into its own file. This creates excessive indirection for helpers tied to one parent.
2. Extract only independent, reusable presentational pieces. This is the chosen approach because it removes real duplication while preserving local behavior and state ownership.
3. Leave all helpers in place. This avoids churn but leaves duplicated form-row markup and makes independent UI pieces harder to catalog.

## Scope

- Extract the shared labeled form-row layout used by settings and marketplace forms into `FormFieldRow`.
- Extract plugin detail metadata rendering into `PluginInformationItem`.
- Extract the chat title overflow/marquee behavior into `ChatTitle`, keeping measurement state local to that component.
- Add colocated stories and focused tests for each extracted component.
- Do not split `Composer`, `SettingsCards`, or page-specific stateful sections; their logic and state remain cohesive.

## Constraints

- No behavior or styling changes.
- Production components must not acquire catalog-only dependencies.
- Existing parent tests and the complete test suite must remain green.
