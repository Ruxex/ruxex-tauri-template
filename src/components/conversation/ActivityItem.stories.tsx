import type { Story } from "@ladle/react";

import { ActivityItem } from "./ActivityItem";
import type { ConversationViewItem } from "./conversation-model";

const commandItem: ConversationViewItem = {
  id: "activity-command",
  turnId: "turn-catalog",
  type: "commandExecution",
  category: "activity",
  title: "Run checks",
  text: "All tests passed.",
  metadata: {
    command: "pnpm check",
    cwd: "/workspace/ruxex",
    status: "completed",
    exitCode: "0",
  },
};

export const Command: Story = () => <ActivityItem item={commandItem} />;

export const InProgress: Story = () => (
  <ActivityItem
    item={{
      ...commandItem,
      id: "activity-running",
      title: "Running checks",
      metadata: { ...commandItem.metadata, status: "inProgress" },
      text: "",
    }}
  />
);
