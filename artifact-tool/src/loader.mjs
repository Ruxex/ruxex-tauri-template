import { pathToFileURL } from "node:url";

const sdkRoot = process.env.RUXEX_ARTIFACT_SDK;
if (!sdkRoot) throw new Error("RUXEX_ARTIFACT_SDK is not configured");

export function resolve(specifier, context, nextResolve) {
  if (specifier === "@ruxex/artifact-tool") {
    return {
      shortCircuit: true,
      url: pathToFileURL(`${sdkRoot}/src/index.mjs`).href,
    };
  }
  return nextResolve(specifier, context);
}
