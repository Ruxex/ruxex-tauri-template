import type { Story } from "@ladle/react";

import { MessageContent } from "./MessageContent";

export const Markdown: Story = () => (
  <MessageContent text="## A message\n\nMarkdown content remains supported." />
);
