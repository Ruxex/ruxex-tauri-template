import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { findMissingStories } from "./check-ladle-component-stories.mjs";

test("findMissingStories reports component files without a colocated story", async () => {
  const root = await mkdtemp(join(tmpdir(), "ruxex-catalog-"));
  await mkdir(join(root, "common"));
  await writeFile(join(root, "common", "Covered.tsx"), "export function Covered() {}\n");
  await writeFile(
    join(root, "common", "Covered.stories.tsx"),
    "export const Default = () => null;\n",
  );
  await writeFile(join(root, "common", "Missing.tsx"), "export function Missing() {}\n");
  await writeFile(join(root, "common", "Missing.test.tsx"), "test();\n");

  assert.deepEqual(findMissingStories(root), ["common/Missing.tsx"]);
});
