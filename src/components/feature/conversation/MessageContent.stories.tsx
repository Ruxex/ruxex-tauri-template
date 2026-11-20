import type { Story } from "@ladle/react";

import { MessageContent } from "./MessageContent";

export default { title: "Feature / Conversation / Message Content" };

export const Markdown: Story = () => <MessageContent text="## A message\n\nMarkdown content remains supported." />;
