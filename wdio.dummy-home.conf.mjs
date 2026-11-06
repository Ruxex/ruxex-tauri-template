import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const configuredBinary =
  process.env.RUXEX_E2E_APP_BINARY ?? "target/debug/ruxex-desktop";
const appBinaryPath = path.isAbsolute(configuredBinary)
  ? configuredBinary
  : path.resolve(repositoryRoot, configuredBinary);

export const config = {
  hostname: "127.0.0.1",
  port: 4444,
  path: "/",
  runner: "local",
  specs: ["./fixtures/dummy-home/**/*.spec.ts"],
  maxInstances: 1,
  maxInstancesPerCapability: 1,
  capabilities: [
    {
      // Keep this service-free: tauri-driver is started by the Python runner.
      "tauri:options": {
        application: appBinaryPath,
      },
      "wdio:enforceWebDriverClassic": true,
    },
  ],
  logLevel: process.env.RUXEX_WDIO_LOG_LEVEL ?? "info",
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    timeout: 60_000,
  },
};
