import type { Story } from "@ladle/react";

import { SubagentDetail } from "./SubagentDetail";

export default { title: "Composite / Thread Summary / Subagent Detail" };

export const Loading: Story = () => <SubagentDetail onBack={() => undefined} threadId="child-catalog" />;
