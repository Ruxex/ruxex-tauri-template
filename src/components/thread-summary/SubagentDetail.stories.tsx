import type { Story } from "@ladle/react";

import { SubagentDetail } from "./SubagentDetail";

export const Loading: Story = () => (
  <SubagentDetail onBack={() => undefined} threadId="child-catalog" />
);
