// @vitest-environment jsdom

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
  modelContextWindow: 200000,
};

describe("TokenUsageSection", () => {
  it("shows total, latest, breakdown, and context window token counts", () => {
    render(<TokenUsageSection usage={usage} />);

    expect(screen.getByRole("heading", { name: "Token Usage" })).toBeTruthy();
    expect(screen.getByText("123,456")).toBeTruthy();
    expect(screen.getByText("4,567")).toBeTruthy();
    expect(screen.getByText("100,000")).toBeTruthy();
    expect(screen.getByText("23,456")).toBeTruthy();
    expect(screen.getByText("200,000")).toBeTruthy();
  });

  it("omits the context window when it is unavailable", () => {
    render(
      <TokenUsageSection
        usage={{ ...usage, modelContextWindow: null }}
      />,
    );

    expect(screen.queryByText("Context window")).toBeNull();
  });

  it("shows an empty state before usage is reported", () => {
    render(<TokenUsageSection usage={null} />);

    expect(screen.getByText("No token usage yet.")).toBeTruthy();
  });
});
