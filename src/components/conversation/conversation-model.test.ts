import { describe, expect, it } from "vitest";

import { normalizeThreadItem } from "./conversation-model";

describe("conversation model", () => {
  it("normalizes imageView items into screenshot presentation metadata", () => {
    const item = normalizeThreadItem("turn-1", {
      type: "imageView",
      id: "image-1",
      path: "/workspace/capture.png",
    });

    expect(item).toMatchObject({
      id: "image-1",
      type: "imageView",
      category: "activity",
      title: "Screenshot",
      imagePath: "/workspace/capture.png",
    });
  });

  it("keeps dynamic tool image outputs available to the renderer", () => {
    const item = normalizeThreadItem("turn-1", {
      type: "dynamicToolCall",
      id: "tool-1",
      namespace: null,
      tool: "browser.snapshot",
      arguments: {},
      status: "completed",
      contentItems: [
        { type: "inputImage", imageUrl: "data:image/png;base64,AA==" },
      ],
      success: true,
      durationMs: 10,
    });

    expect(item.imageUrls).toEqual(["data:image/png;base64,AA=="]);
  });

  it("extracts a browser URL for an explicit external-browser action", () => {
    const item = normalizeThreadItem("turn-1", {
      type: "dynamicToolCall",
      id: "tool-2",
      namespace: "browser",
      tool: "browser.navigate",
      arguments: { url: "https://example.test/session" },
      status: "completed",
      contentItems: null,
      success: true,
      durationMs: 5,
    });

    expect(item.browserUrl).toBe("https://example.test/session");
  });
});
