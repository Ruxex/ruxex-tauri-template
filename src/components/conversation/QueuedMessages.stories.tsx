import type { Story } from "@ladle/react";

import { QueuedMessages } from "./QueuedMessages";

export const Empty: Story = () => (
  <QueuedMessages threadId="thread-catalog" />
);
