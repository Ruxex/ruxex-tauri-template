import type { Story } from "@ladle/react";
import type { ReactNode } from "react";

import { ChatListItem } from "./ChatListItem";

function Surface({ children }: { children: ReactNode }) {
  return <div className="w-96 bg-base-100 p-4">{children}</div>;
}

const thread = {
  id: "thread-catalog",
  name: "Product planning",
  preview: "Discuss the next release scope",
  updatedAt: 0,
};

export const Default: Story = () => (
  <Surface>
    <ChatListItem thread={thread} />
  </Surface>
);

export const SelectedUnread: Story = () => (
  <Surface>
    <ChatListItem
      selected
      thread={thread}
      unread
      showPreview
      projectName="Ruxex"
      worktreeLabel="main"
    />
  </Surface>
);

export const WaitingForApproval: Story = () => (
  <Surface>
    <ChatListItem status="waiting" thread={thread} />
  </Surface>
);

export const Failed: Story = () => (
  <Surface>
    <ChatListItem status="failed" thread={thread} />
  </Surface>
);

export const LongTitle: Story = () => (
  <Surface>
    <ChatListItem
      onArchive={() => undefined}
      thread={{
        ...thread,
        name: "A very long chat title that should stay inside the sidebar width",
      }}
    />
  </Surface>
);
