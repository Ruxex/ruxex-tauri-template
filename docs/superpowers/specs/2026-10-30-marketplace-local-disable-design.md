# Marketplace local disable design

## Intent

Allow the Tauri client to temporarily remove a marketplace from the App
Server while retaining enough source configuration to restore it later. This
is client-local state; the App Server protocol remains unchanged.

## Goals

- Persist disabled marketplace source settings locally: source, Git ref, and
  sparse paths.
- Disable an active marketplace by saving its settings and then calling
  `marketplace/remove`.
- Re-enable a disabled marketplace by calling `marketplace/add` with the saved
  settings.
- Show explicit pending states while App Server performs clone/read work.
- Recover settings for marketplaces already configured before this feature by
  reading the App Server's effective `marketplaces` config.

## Non-goals

- Do not add an App Server marketplace-enabled flag or protocol method.
- Do not change the meaning of plugin execution policy on the server.
- Do not persist marketplace plugin contents or server-backed status locally.

## Approaches

1. Add enable/disable state to the App Server protocol. This would be shared
   across clients but requires protocol, server, and configuration changes.
2. Persist disabled marketplace definitions in the Tauri client and translate
   enable/disable into App Server add/remove calls. This keeps the state
   client-local and fits the current API, so this is the selected approach.

## Design

Use a versioned local-storage record keyed by marketplace name:

```ts
{ version: 1, disabled: { [name]: { source, refName?, sparsePaths? } } }
```

Active marketplaces come from `plugin/list`. Disabled marketplaces are shown
from this local record. The page reads `config/read` to recover source
settings for active marketplaces that were configured before this feature.
Each add, remove, update, and re-enable mutation has an explicit pending state
and disables conflicting controls until the request completes.
