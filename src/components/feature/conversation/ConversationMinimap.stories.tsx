import type { Story } from "@ladle/react";
import { useRef } from "react";

import type { ConversationViewItem } from "./conversation-model";
import { ConversationMinimap } from "./ConversationMinimap";

const items: ConversationViewItem[] = [1, 2, 3].map((index) => ({
  id: `user-${index}`,
  turnId: "turn-catalog",
  type: "userMessage",
  category: "message",
  title: "You",
  text: `Example message ${index} in the conversation.`,
}));

export const WithMarkers: Story = () => {
  const timelineRef = useRef<HTMLElement>(null);
  return (
    <div className="@container/chat flex h-[32rem] justify-end p-4">
      <ConversationMinimap items={items} timelineRef={timelineRef} />
    </div>
  );
};
