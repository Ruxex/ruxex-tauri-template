import type { Story } from "@ladle/react";

import { ConversationWorkspace } from "./ConversationWorkspace";

export const LoadingConversation: Story = () => (
  <ConversationWorkspace threadId="thread-catalog" />
);
