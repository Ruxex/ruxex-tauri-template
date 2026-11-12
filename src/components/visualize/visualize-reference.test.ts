import { describe, expect, it } from "vitest";

import { parseVisualizeReferences } from "./visualize-reference";

describe("parseVisualizeReferences", () => {
  it("parses regular and wide Codex references", () => {
    expect(
      parseVisualizeReferences(
        'Before\nvisualize{"path":"/tmp/chart.html"}\nAfter\nvisualize{"path":"/tmp/app.html","mode":"wide"}',
      ),
    ).toEqual([
      { type: "markdown", text: "Before\n" },
      {
        type: "visualize",
        reference: { path: "/tmp/chart.html", mode: "regular" },
      },
      { type: "markdown", text: "\nAfter\n" },
      {
        type: "visualize",
        reference: { path: "/tmp/app.html", mode: "wide" },
      },
    ]);
  });

  it("keeps invalid tokens as markdown", () => {
    const text = [
      "bad visualize{not-json}",
      'missing visualize{"mode":"wide"}',
      'unknown visualize{"path":"/tmp/chart.html","mode":"full"}',
    ].join("\n");

    expect(parseVisualizeReferences(text)).toEqual([
      { type: "markdown", text },
    ]);
  });

  it("does not interpret ordinary HTML or code fences", () => {
    const text = "```html\n<div>not a visualize marker</div>\n```";

    expect(parseVisualizeReferences(text)).toEqual([
      { type: "markdown", text },
    ]);
  });
});
