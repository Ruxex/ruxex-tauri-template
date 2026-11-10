import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(
  fileURLToPath(new URL("../index.html", import.meta.url)),
  "utf8",
);

describe("application input behavior", () => {
  it("disables automatic capitalization at the document root", () => {
    expect(indexHtml).toMatch(/<html\b[^>]*\bautocapitalize="none"[^>]*>/);
  });
});
