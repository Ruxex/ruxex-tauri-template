# Settings Runtime Paths Design

## Intent

Make the Desktop App's runtime locations easier to identify from Settings. Users should be able to find the provider's data location near provider/account information, and inspect the complete Unix socket path even when the row is visually truncated.

## Goals

- Show the resolved provider data location in `Settings > Models / Engines > Provider and account` with the user-facing label `Data directory`.
- Expose the resolved data directory from the native runtime through the existing app-server status response.
- Keep the App Server socket row compact while exposing the complete path on hover, with the user-facing label `UnixSocket`.
- Preserve the existing responsive settings layout and unavailable-state behavior.

## Non-goals

- Do not add controls for changing either path.
- Do not change provider selection, authentication, or app-server connection behavior.
- Do not duplicate the data directory in the App Server card.

## Constraints

- Follow the existing Tauri command, typed frontend API, React Query, settings-card, and Vitest conventions.
- The native value must be the actual resolved Desktop runtime home, including custom branding/provider configurations.
- `Data directory` is display copy only; the transport field remains `homeDataDir` for stable typed wiring.

## Approaches

- Add both values to the App Server card: technically smallest, but places provider-owned data information away from the provider/account context.
- Add both values to the Provider and account card: keeps related information together, but mixes connection diagnostics into provider information.
- **Selected:** add `Data directory` to Provider and account, and keep `UnixSocket` in App Server. This matches the requested provider-area placement, avoids duplicate data, and keeps the socket with connection details.

## Design

Extend the native `AppServerStatus` payload with `homeDataDir`, populated from the same resolved path used to initialize the Desktop runtime. Mirror the field in the frontend `AppServerStatus` type. `ModelPage` reads the existing app-server status query and passes the path to `ProviderAccountCard`; the card renders `Data directory`, or `Unavailable` when no path is available. `AppServerCard` changes the socket label to `UnixSocket` and keeps the full value in the element's `title` attribute while using the existing truncation classes.

Tests will cover native status serialization, provider-card rendering and fallback, app-server socket label/hover metadata, and the Model page wiring. Existing full frontend and Rust verification commands remain the completion gate.
