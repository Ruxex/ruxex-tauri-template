import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import type { Options } from "@wdio/types";

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const appBinaryPath = path.resolve(
  repositoryRoot,
  process.env.RUXEX_E2E_APP_BINARY ?? "target/debug/ruxex-desktop",
);
const artifactDirectory = process.env.RUXEX_E2E_ARTIFACTS
  ? path.resolve(process.env.RUXEX_E2E_ARTIFACTS)
  : undefined;
const tauriDriverPath = process.env.TAURI_DRIVER_PATH;
const e2ePluginEnabled = process.env.RUXEX_E2E_PLUGIN === "1";

function safeFileName(value: string): string {
  return (
    value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^\.+|\.+$/g, "") || "test"
  );
}

const tauriServiceOptions = {
  driverProvider: "external" as const,
  appBinaryPath,
  ...(tauriDriverPath ? { tauriDriverPath } : {}),
  captureBackendLogs: e2ePluginEnabled,
  captureFrontendLogs: e2ePluginEnabled,
  backendLogLevel: "info" as const,
  frontendLogLevel: "info" as const,
  logLevel: "info" as const,
  startTimeout: 60_000,
  ...(artifactDirectory ? { logDir: artifactDirectory } : {}),
};

export const config: Options.Testrunner = {
  runner: "local",
  specs: ["./e2e/**/*.spec.ts"],
  maxInstances: 1,
  maxInstancesPerCapability: 1,
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": {
        application: appBinaryPath,
      },
    },
  ],
  logLevel: (process.env.RUXEX_E2E_LOG_LEVEL ?? "info") as Options.LogLevel,
  framework: "mocha",
  reporters: artifactDirectory
    ? [["spec", { outputDir: artifactDirectory }]]
    : ["spec"],
  services: [["@wdio/tauri-service", tauriServiceOptions]],
  afterTest: async (test, _context, result) => {
    if (result.passed || !artifactDirectory) {
      return;
    }

    const name = `${safeFileName(test.parent)}-${safeFileName(test.title)}`;
    try {
      await mkdir(artifactDirectory, { recursive: true });
      await browser.saveScreenshot(path.join(artifactDirectory, `${name}.png`));
      await writeFile(
        path.join(artifactDirectory, `${name}.html`),
        await browser.getPageSource(),
        "utf8",
      );
    } catch (error) {
      console.error(
        `[e2e-artifacts] failed to save evidence for ${name}:`,
        error,
      );
    }
  },
  mochaOpts: {
    timeout: 60_000,
  },
};
