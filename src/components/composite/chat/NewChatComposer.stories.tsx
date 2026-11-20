import type { Story } from "@ladle/react";

import { NewChatComposer } from "./NewChatComposer";

export default { title: "Composite / Chat / New Chat Composer" };

export const Empty: Story = () => <NewChatComposer />;

export const ForProject: Story = () => <NewChatComposer projectId="project-catalog" />;
