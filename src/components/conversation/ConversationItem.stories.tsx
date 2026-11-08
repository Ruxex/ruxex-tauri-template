import type { Story } from "@ladle/react";

import { ConversationItem } from "./ConversationItem";
import type { ConversationViewItem } from "./conversation-model";

const assistantItem: ConversationViewItem = {
  id: "message-assistant",
  turnId: "turn-catalog",
  type: "agentMessage",
  category: "message",
  title: "Assistant",
  text: "The component catalog is ready for review.",
};

const userItem: ConversationViewItem = {
  id: "message-user",
  turnId: "turn-catalog",
  type: "userMessage",
  category: "message",
  title: "You",
  text: "Please review the catalog.",
  editable: true,
  timestamp: 1_735_000_000,
};

export const Assistant: Story = () => <ConversationItem item={assistantItem} />;

export const UserEditable: Story = () => (
  <ConversationItem item={userItem} onEdit={async () => undefined} />
);
