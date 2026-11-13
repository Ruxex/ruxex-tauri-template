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
  it("shows only input, output, and total token counts", () => {
    render(<TokenUsageSection usage={usage} />);

    expect(screen.getByRole("heading", { name: "Token Usage" })).toBeTruthy();
    expect(screen.getByTitle("Input tokens").textContent).toContain("100,000");
    expect(screen.getByTitle("Output tokens").textContent).toContain("23,456");
    expect(screen.getByTitle("Total tokens").textContent).toContain("123,456");
    expect(screen.queryByText("Latest turn")).toBeNull();
    expect(screen.queryByText("Reasoning")).toBeNull();
    expect(screen.queryByText("Context window")).toBeNull();
  });

  it("hides the section before usage is reported", () => {
    render(<TokenUsageSection usage={null} />);

    expect(screen.queryByRole("heading", { name: "Token Usage" })).toBeNull();
    expect(screen.queryByText("No token usage yet.")).toBeNull();
  });
});
