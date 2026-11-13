import type { Story } from "@ladle/react";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";

const tokenUsage = {
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

export const Loaded: Story = () => (
  <ThreadSummaryPanel
    tokenUsage={tokenUsage}
    gitDiff={{ added: 42, deleted: 18, files: 2 }}
  />
);

export const GitOnly: Story = () => (
  <ThreadSummaryPanel
    tokenUsage={null}
    gitDiff={{ added: 42, deleted: 18, files: 2 }}
  />
);
