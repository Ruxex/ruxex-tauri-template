import type { Story } from "@ladle/react";

import { ActivityRow } from "./ActivityRow";

export const RunningSubagent: Story = () => (
  <ul className="max-w-3xl">
    <ActivityRow
      entry={{
        id: "agent-api",
        kind: "agent",
        title: "API scout agent",
        detail: "Inspect the API client",
        threadId: "child-api",
        status: "running",
        timestamp: Date.now(),
        needsAction: false,
      }}
    />
  </ul>
);
