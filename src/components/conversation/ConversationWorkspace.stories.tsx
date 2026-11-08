import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "../../app-server/query-keys";
import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { ConversationWorkspace } from "./ConversationWorkspace";

export const LoadingConversation: Story = () => (
  <CatalogSurface>
    <ConversationWorkspace threadId="thread-catalog" />
  </CatalogSurface>
);

const thread = {
  id: "thread-catalog",
  name: "Improve the component catalog",
  preview: "Review states, spacing, and responsive behavior.",
  model: "gpt-5-codex",
  reasoningEffort: "medium",
  cwd: "/workspace/ruxex",
  status: { type: "idle" },
} as never;

const model = {
  id: "model-codex",
  model: "gpt-5-codex",
  displayName: "GPT-5 Codex",
  description: "Strong coding and reasoning model",
  upgrade: null,
  upgradeInfo: null,
  availabilityNux: null,
  modelSpecialty: "coding",
  hidden: false,
  supportedReasoningEfforts: [
    { reasoningEffort: "medium", description: "Balanced reasoning" },
    { reasoningEffort: "high", description: "Deeper reasoning" },
  ],
  defaultReasoningEffort: "medium",
  inputModalities: ["text"],
  multiAgentVersion: null,
  additionalSpeedTiers: [],
  serviceTiers: [],
  defaultServiceTier: null,
  availableAccessPrograms: null,
  isDefault: true,
} as never;

const conversationItems = {
  data: [
    {
      turnId: "turn-catalog",
      item: {
        type: "userMessage",
        id: "user-catalog",
        clientId: null,
        content: [
          {
            type: "text",
            text: "Review the current component catalog.",
            text_elements: [],
          },
        ],
      },
    },
    {
      turnId: "turn-catalog",
      item: {
        type: "agentMessage",
        id: "assistant-catalog",
        text: "I found a few opportunities to clarify loading, error, and empty states.",
      },
    },
  ],
  nextCursor: null,
  backwardsCursor: null,
};

export const LoadedConversation: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: appServerQueryKeys.models,
        data: { data: [model], nextCursor: null },
      },
      {
        queryKey: [
          ...appServerQueryKeys.threadMetadata("thread-catalog"),
          { includeTurns: false },
        ],
        data: { thread },
      },
      {
        queryKey: appServerQueryKeys.threadTurns("thread-catalog", {}),
        data: { data: [], nextCursor: null, backwardsCursor: null },
      },
      {
        queryKey: appServerQueryKeys.threadItems("thread-catalog", {}),
        data: conversationItems,
      },
      {
        queryKey: appServerQueryKeys.threadQueue("thread-catalog", {}),
        data: { data: [], nextCursor: null },
      },
    ]}
  >
    <CatalogSurface>
      <ConversationWorkspace threadId="thread-catalog" />
    </CatalogSurface>
  </CatalogQueryProvider>
);

export const ErrorState: Story = () => (
  <CatalogSurface>
    <ConversationWorkspace threadId="missing-thread" />
  </CatalogSurface>
);
