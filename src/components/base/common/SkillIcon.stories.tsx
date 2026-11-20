import type { Story } from "@ladle/react";

import { SkillIcon } from "./SkillIcon";

export default { title: "Base / Common / Skill Icon" };

export const Fallback: Story = () => (
  <div className="flex items-center gap-3 p-4">
    <SkillIcon skill={{ name: "review" }} />
    <span>Review skill without an icon</span>
  </div>
);
