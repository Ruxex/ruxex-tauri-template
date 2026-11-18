import type { Story } from "@ladle/react";
import { SelectedComposerSkill } from "./SelectedComposerSkill";

export const Selected: Story = () => (
  <div className="p-4">
    <SelectedComposerSkill skill={{ name: "review", path: "/skills/review" }} onRemove={() => undefined} />
  </div>
);
