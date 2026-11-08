import type { Story } from "@ladle/react";

import { ChatSearchDialog } from "./ChatSearchDialog";

export const Open: Story = () => (
  <ChatSearchDialog onClose={() => undefined} onSelect={() => undefined} />
);
