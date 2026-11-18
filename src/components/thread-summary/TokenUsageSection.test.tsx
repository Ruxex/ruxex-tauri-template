// @vitest-environment jsdom

import { i18n } from "../../app/i18n";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { v2 } from "../../protocol";
import { TokenUsageSection } from "./TokenUsageSection";

afterEach(cleanup);

const usage: v2.ThreadTokenUsage = {
  total: {
    totalTokens: 123456,
    inputTokens: 100000,
    cachedInputTokens: 12000,
    cacheWriteInputTokens: 1000,
    outputTokens: 23456,
    reasoningOutputTokens: 3456,
  },
  last: {
    totalTokens: 4567,
    inputTokens: 3000,
    cachedInputTokens: 400,
    cacheWriteInputTokens: 100,
    outputTokens: 1567,
    reasoningOutputTokens: 200,
  },
  totalAmount: 1234.56789,
  lastAmount: 0.42,
  modelContextWindow: 200000,
};

describe("TokenUsageSection", () => {
  it("shows compact token counts with the exact value on hover", () => {
    render(<TokenUsageSection usage={usage} />);

    expect(screen.getByRole("heading", { name: "Token Usage" })).toBeTruthy();
    const summary = screen.getByTitle(
      "Input tokens: 100,000; Output tokens: 23,456; Total tokens: 123,456",
    );
    expect(summary.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "123.5k (100k/23.5k)",
    );
    expect(
      screen.getByText("Input 100,000, Output 23,456, Total 123,456"),
    ).toBeTruthy();
    expect(
      screen
        .getByTitle("Total amount: 1,234.57")
        .querySelector('[aria-hidden="true"]')?.textContent,
    ).toBe("1,234.57");
    expect(screen.queryByText("Latest turn")).toBeNull();
    expect(screen.queryByText("Reasoning")).toBeNull();
    expect(screen.queryByText("Context window")).toBeNull();
  });

  it("hides the section before usage is reported", () => {
    render(<TokenUsageSection usage={null} />);

    expect(screen.queryByRole("heading", { name: "Token Usage" })).toBeNull();
    expect(screen.queryByText("No token usage yet.")).toBeNull();
  });
  it("keeps compact token counts consistent across locales", async () => {
    await i18n.changeLanguage("ja");
    render(<TokenUsageSection usage={usage} />);
    expect(
      screen.getByRole("heading", { name: "トークン使用量" }),
    ).toBeTruthy();
    const summary = screen.getByTitle(
      "入力トークン: 100,000; 出力トークン: 23,456; 合計トークン: 123,456",
    );
    expect(summary.querySelector('[aria-hidden="true"]')?.textContent).toBe(
      "123.5k (100k/23.5k)",
    );
    expect(
      screen.getByText("入力 100,000、出力 23,456、合計 123,456"),
    ).toBeTruthy();
    expect(screen.getByTitle("合計金額: 1,234.57")).toBeTruthy();
  });
});
