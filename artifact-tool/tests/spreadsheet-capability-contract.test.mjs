import assert from "node:assert/strict";
import { test } from "node:test";

import { Workbook } from "../src/index.mjs";

test("Workbook reports stable local spreadsheet capabilities and exclusions", () => {
  const capabilities = Workbook.capabilities();
  const byId = new Map(capabilities.map((item) => [item.id, item]));

  assert.equal(byId.get("xlsx.create")?.status, "supported");
  assert.equal(byId.get("xlsx.import")?.status, "partial");
  assert.equal(byId.get("csv.import")?.status, "supported");
  assert.equal(byId.get("data-validation")?.status, "partial");
  assert.equal(byId.get("formulas.evaluate")?.status, "partial");
  assert.equal(byId.get("workbook.render")?.status, "partial");
  assert.equal(byId.get("google-sheets")?.status, "excluded");
  assert.match(byId.get("workbook.render")?.limitation ?? "", /render/i);
});

test("workbook.help returns bounded matching capability documentation", () => {
  const workbook = Workbook.create();
  const help = workbook.help("chart", { maxResults: 1 });

  assert.equal(help.results.length, 1);
  assert.match(help.results[0].id, /chart/i);
  assert.equal(help.truncated, true);
});
