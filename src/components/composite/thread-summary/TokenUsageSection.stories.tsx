import type { Story } from "@ladle/react";
import type { v2 } from "@/protocol";
import { TokenUsageSection } from "./TokenUsageSection";

const usage = {
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
} as v2.ThreadTokenUsage;

export const Loaded: Story = () => <TokenUsageSection usage={usage} />;
export const Unavailable: Story = () => <TokenUsageSection usage={null} />;
