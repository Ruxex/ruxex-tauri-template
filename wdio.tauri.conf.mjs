import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredBinary =
  process.env.RUXEX_SESSION_APP_BINARY ?? "target/debug/ruxex-desktop";
const appBinaryPath = path.isAbsolute(configuredBinary)
  ? configuredBinary
  : path.resolve(repositoryRoot, configuredBinary);

export const config = {
  hostname: process.env.WDIO_SESSION_DRIVER_HOST ?? "127.0.0.1",
  port: Number(process.env.WDIO_TAURI_DRIVER_PORT ?? "4444"),
  path: process.env.WDIO_SESSION_DRIVER_PATH ?? "/",
  logLevel: process.env.RUXEX_WDIO_LOG_LEVEL ?? "info",
  capabilities: [
    {
      // WebKitWebDriver rejects browserName="wry" on this Linux setup.
      // tauri:options is sufficient for tauri-driver to launch the binary.
      "tauri:options": {
        application: appBinaryPath,
      },
      "wdio:enforceWebDriverClassic": true,
    },
  ],
};
