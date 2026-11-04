import { describe, expect, it } from "vitest";

import { getConfigWriteErrorCode } from "./mcp-config-errors";

describe("MCP config write errors", () => {
  it("reads the stable App Server error code", () => {
    expect(
      getConfigWriteErrorCode({
        data: { config_write_error_code: "configVersionConflict" },
        message: "a different message",
      }),
    ).toBe("configVersionConflict");
  });

  it("does not classify errors from their human-readable message", () => {
    expect(
      getConfigWriteErrorCode({
        data: undefined,
        message: "Configuration was modified since last read",
      }),
    ).toBeNull();
  });
});
