import { describe, expect, it } from "vitest";

import { i18n } from "./i18n";
import { AppUiError, formatErrorMessage } from "./error-message";

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
    expect(formatErrorMessage(new Error("socket closed"))).toBe("Error: socket closed");
  });
});

describe("Japanese application errors", () => {
  it("maps stable app error codes and preserves arbitrary server details", async () => {
    await i18n.changeLanguage("ja");
    expect(formatErrorMessage({ code: "pluginLocalMarketplaceRequired" })).toBe(
      "プラグインの詳細にはローカルマーケットプレイスが必要です。",
    );
    expect(
      formatErrorMessage({
        code: -32601,
        message: "provider/model: unavailable",
      }),
    ).toBe("provider/model: unavailable");
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(formatErrorMessage(cyclic)).toBe("エラーを表示できません。");
    await i18n.changeLanguage("en");
  });
});

it("resolves a stored Ruxex error code in the current language", async () => {
  const error = new AppUiError("mcpResourceSelectionRequired");
  expect(formatErrorMessage(error)).toBe("MCP Resource selection is required.");
  await i18n.changeLanguage("ja");
  expect(formatErrorMessage(error)).toBe("MCP リソースを選択してください。");
});
