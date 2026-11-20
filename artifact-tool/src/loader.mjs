import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sdkRoot = process.env.RUXEX_ARTIFACT_SDK;
const nodeModulesRoot = process.env.RUXEX_ARTIFACT_NODE_MODULES;
const runtimeEntries = {
  docx: "dist/index.mjs",
  "docx/watermarks": { package: "docx", entry: "dist/watermarks.mjs" },
  pptxgenjs: "dist/pptxgen.es.js",
  jszip: "lib/index.js",
  sharp: "lib/index.js",
  "pdf-lib": "cjs/index.js",
  "jsonpath-plus": "dist/index-node-esm.js",
};

export function resolve(specifier, context, nextResolve) {
  if (specifier === "@ruxex/artifact-tool") {
    if (!sdkRoot) throw new Error("RUXEX_ARTIFACT_SDK is not configured");
    return {
      shortCircuit: true,
      url: pathToFileURL(`${sdkRoot}/src/index.mjs`).href,
    };
  }
  const runtimeEntry = runtimeEntries[specifier];
  if (runtimeEntry) {
    if (!nodeModulesRoot) throw new Error("RUXEX_ARTIFACT_NODE_MODULES is not configured");
    const packageName = typeof runtimeEntry === "string" ? specifier : runtimeEntry.package;
    const packagePath = typeof runtimeEntry === "string" ? runtimeEntry : runtimeEntry.entry;
    return {
      shortCircuit: true,
      url: pathToFileURL(realpathSync(`${nodeModulesRoot}/${packageName}/${packagePath}`)).href,
    };
  }
  return nextResolve(specifier, context);
}
