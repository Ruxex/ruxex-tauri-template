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
  totalAmount: 0.42,
  lastAmount: 0.03,
  modelContextWindow: 200000,
};

const subagents = ["Atlas", "Beacon", "Cipher", "Delta", "Echo", "Fable", "Grove", "Harbor", "Indigo", "Juniper"].map(
  (label, index) => ({
    threadId: `subagent-${index}`,
    label,
    role: null,
    task: "",
    status: "done" as const,
    summary: null,
    updatedAt: index,
    waitingForApproval: false,
  }),
);

export const Loaded: Story = () => (
  <ThreadSummaryPanel tokenUsage={tokenUsage} gitDiff={{ added: 42, deleted: 18, files: 2 }} subagents={subagents} />
);

export const GitOnly: Story = () => (
  <ThreadSummaryPanel tokenUsage={null} gitDiff={{ added: 42, deleted: 18, files: 2 }} />
);
