import type { Story } from "@ladle/react";

import { Composer } from "./Composer";

export const Empty: Story = () => (
  <Composer activeTurnId={null} threadId="thread-catalog" />
);

export const WithInitialMessage: Story = () => (
  <Composer
    activeTurnId={null}
    initialMessage="Please review the current component catalog."
    threadId="thread-catalog"
  />
);
