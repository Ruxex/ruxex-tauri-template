import type { Story } from "@ladle/react";
import { ComposerMessageInput } from "./ComposerMessageInput";

export default { title: "Feature / Conversation / Composer Message Input" };

export const Empty: Story = () => (
  <div className="max-w-3xl rounded-box border border-base-300 bg-base-100 p-4">
    <ComposerMessageInput disabled={false} placeholder="Write a message…" value="" onChange={() => undefined} />
  </div>
);
