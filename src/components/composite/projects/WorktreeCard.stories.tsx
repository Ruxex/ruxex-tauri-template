import type { Story } from "@ladle/react";

import { WorktreeCard } from "./WorktreeCard";

export default { title: "Composite / Projects / Worktree Card" };

export const Repository: Story = () => <WorktreeCard root="/workspace/ruxex" />;
