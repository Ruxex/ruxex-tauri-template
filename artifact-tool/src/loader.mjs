import { pathToFileURL } from "node:url";

const sdkRoot = process.env.RUXEX_ARTIFACT_SDK;
const nodeModulesRoot = process.env.RUXEX_ARTIFACT_NODE_MODULES;
const runtimeEntries = {
  docx: "dist/index.mjs",
  pptxgenjs: "dist/pptxgen.es.js",
};

export function resolve(specifier, context, nextResolve) {
  if (specifier === "@ruxex/artifact-tool") {
    if (!sdkRoot) throw new Error("RUXEX_ARTIFACT_SDK is not configured");
    return {
      shortCircuit: true,
      url: pathToFileURL(`${sdkRoot}/src/index.mjs`).href,
    };
  }
  if (runtimeEntries[specifier]) {
    if (!nodeModulesRoot) throw new Error("RUXEX_ARTIFACT_NODE_MODULES is not configured");
    return {
      shortCircuit: true,
      url: pathToFileURL(`${nodeModulesRoot}/${specifier}/${runtimeEntries[specifier]}`).href,
    };
  }
  return nextResolve(specifier, context);
}
