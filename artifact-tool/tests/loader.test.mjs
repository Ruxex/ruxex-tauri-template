import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import test from "node:test";

test("resolves docx subpath imports through pnpm package symlinks", async () => {
  const previous = process.env.RUXEX_ARTIFACT_NODE_MODULES;
  const temporary = mkdtempSync(join(tmpdir(), "ruxex-loader-test-"));
  const modules = join(temporary, "node_modules");
  const packageRoot = join(temporary, ".pnpm/docx@9.15.3/node_modules/docx");
  mkdirSync(join(packageRoot, "dist"), { recursive: true });
  writeFileSync(join(packageRoot, "dist/watermarks.mjs"), "export {};\n");
  mkdirSync(modules, { recursive: true });
  symlinkSync(packageRoot, join(modules, "docx"), "dir");
  process.env.RUXEX_ARTIFACT_NODE_MODULES = modules;
  try {
    const { resolve } = await import(`../src/loader.mjs?watermarks=${randomUUID()}`);
    const result = resolve("docx/watermarks", {}, () => {
      throw new Error("docx/watermarks should be resolved by the runtime loader");
    });
    assert.equal(
      result.url,
      pathToFileURL(join(packageRoot, "dist/watermarks.mjs")).href,
    );
    assert.equal(result.shortCircuit, true);
  } finally {
    if (previous === undefined) delete process.env.RUXEX_ARTIFACT_NODE_MODULES;
    else process.env.RUXEX_ARTIFACT_NODE_MODULES = previous;
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("resolves pdf-lib to its Node-compatible CommonJS entry", async () => {
  const previous = process.env.RUXEX_ARTIFACT_NODE_MODULES;
  const temporary = mkdtempSync(join(tmpdir(), "ruxex-loader-test-"));
  const modules = join(temporary, "node_modules");
  const packageRoot = join(temporary, ".pnpm/pdf-lib@1.17.1/node_modules/pdf-lib");
  mkdirSync(join(packageRoot, "cjs"), { recursive: true });
  writeFileSync(join(packageRoot, "cjs/index.js"), "exports.PDFDocument = {};\n");
  mkdirSync(modules, { recursive: true });
  symlinkSync(packageRoot, join(modules, "pdf-lib"), "dir");
  process.env.RUXEX_ARTIFACT_NODE_MODULES = modules;
  try {
    const { resolve } = await import(`../src/loader.mjs?pdf-lib=${randomUUID()}`);
    const result = resolve("pdf-lib", {}, () => {
      throw new Error("pdf-lib should be resolved by the runtime loader");
    });
    assert.equal(
      result.url,
      pathToFileURL(join(packageRoot, "cjs/index.js")).href,
    );
    assert.equal(result.shortCircuit, true);
  } finally {
    if (previous === undefined) delete process.env.RUXEX_ARTIFACT_NODE_MODULES;
    else process.env.RUXEX_ARTIFACT_NODE_MODULES = previous;
    rmSync(temporary, { recursive: true, force: true });
  }
});
