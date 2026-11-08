import { spawn } from "node:child_process";

import { ArtifactToolError } from "./a1-range.mjs";

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

function enginePath() {
  const path = process.env.RUXEX_ARTIFACT_ENGINE;
  if (!path) {
    throw new ArtifactToolError(
      "missing_runtime_resource",
      "RUXEX_ARTIFACT_ENGINE is not configured",
    );
  }
  return path;
}

export function runEngine(request) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(enginePath(), ["--json-stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const failForOutputLimit = () => {
      child.kill();
      reject(new ArtifactToolError("engine_output_limit", "artifact engine output exceeded the limit"));
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) failForOutputLimit();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (Buffer.byteLength(stderr) > MAX_OUTPUT_BYTES) failForOutputLimit();
    });
    child.on("error", (error) => {
      reject(new ArtifactToolError("engine_launch_error", error.message));
    });
    child.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (error) {
          reject(new ArtifactToolError("invalid_engine_response", error.message));
        }
        return;
      }
      let diagnostic;
      try {
        diagnostic = JSON.parse(stderr);
      } catch {
        diagnostic = null;
      }
      reject(
        new ArtifactToolError(
          diagnostic?.error?.code ?? "engine_error",
          diagnostic?.error?.message ?? (stderr.trim() || `artifact engine exited with status ${code}`),
          diagnostic,
        ),
      );
    });
    child.stdin.end(`${JSON.stringify(request)}\n`);
  });
}
