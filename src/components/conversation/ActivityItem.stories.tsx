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

export const ToolCall: Story = () => (
  <ActivityItem
    item={{
      ...commandItem,
      id: "activity-tool",
      type: "dynamicToolCall",
      title: "Inspect repository",
      text: '{"path":"/workspace/ruxex"}',
      metadata: {
        namespace: "filesystem",
        status: "completed",
        success: "true",
      },
    }}
  />
);

export const FileChanges: Story = () => (
  <ActivityItem
    item={{
      ...commandItem,
      id: "activity-files",
      type: "fileChange",
      title: "Update component styles",
      text: "src/components/Composer.tsx\nsrc/components/Sidebar.tsx",
      metadata: { files: "2", status: "completed" },
    }}
  />
);
