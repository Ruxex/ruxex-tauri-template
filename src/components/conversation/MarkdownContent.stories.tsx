import type { Story } from "@ladle/react";

import { MarkdownContent } from "./MarkdownContent";

export const RichText: Story = () => (
  <MarkdownContent
    text={"# Component catalog\n\n**Bold** and *emphasis* with `inline code`.\n\n- Loading\n- Error\n- Empty\n\n```ts\nconst ready = true;\n```"}
  />
);

export const Diff: Story = () => (
  <MarkdownContent text={"```diff\n- old value\n+ new value\n  unchanged\n```"} />
);
