import type { Story } from "@ladle/react";

import { StoryVariantList } from "../../../../.ladle/support/StoryVariantList";
import type { ConversationViewItem } from "@/components/feature/conversation/conversation-model";
import { CompletedTurnGroup, WorkingIndicator } from "./TimelineActivityParts";

const items: ConversationViewItem[] = [
  {
    id: "user-1",
    turnId: "turn-1",
    type: "userMessage",
    category: "message",
    title: "You",
    text: "Summarize the component catalog changes.",
  },
  {
    id: "tool-1",
    turnId: "turn-1",
    type: "commandExecution",
    category: "activity",
    title: "Run checks",
    text: "Catalog check passed.",
    metadata: {
      command: "pnpm check:catalog",
      status: "completed",
      exitCode: "0",
    },
  },
  {
    id: "assistant-1",
    turnId: "turn-1",
    type: "agentMessage",
    category: "message",
    title: "Assistant",
    text: "The catalog now includes the new component states.",
  },
];

export const States: Story = () => (
  <StoryVariantList
    variants={[
      {
        content: (
          <CompletedTurnGroup
            items={items}
            turn={
              {
                id: "turn-1",
                status: "completed",
                startedAt: 1_700_000_000,
              } as never
            }
          />
        ),
        label: "Completed turn",
      },
      {
        content: <WorkingIndicator active label="Generating response" />,
        label: "Working",
      },
      {
        content: <WorkingIndicator empty label="Start a new conversation" />,
        label: "Empty state",
      },
    ]}
  />
);
