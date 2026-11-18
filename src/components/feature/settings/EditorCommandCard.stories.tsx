import type { Story } from "@ladle/react";
import { EditorCommandCard } from "./EditorCommandCard";

export const Configured: Story = () => (
  <div className="max-w-3xl p-4">
    <EditorCommandCard command="code --reuse-window {file}:{line}" onCommandChange={() => undefined} />
  </div>
);
