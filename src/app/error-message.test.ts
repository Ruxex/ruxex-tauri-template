import { describe, expect, it } from "vitest";

import { formatErrorMessage } from "./error-message";

describe("formatErrorMessage", () => {
  it("uses the message from structured app-server errors", () => {
    expect(
      formatErrorMessage({
        kind: "server",
        message: "thread/start failed: model unavailable (code -32601)",
      }),
    ).toBe("thread/start failed: model unavailable (code -32601)");
  });

  it("preserves regular Error messages", () => {
    expect(formatErrorMessage(new Error("socket closed"))).toBe(
      "Error: socket closed",
    );
  });
});
