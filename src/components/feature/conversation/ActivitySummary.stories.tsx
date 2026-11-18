import type { Story } from "@ladle/react";
import { getActivityPresentation } from "./activity-presentation";
import type { ConversationViewItem } from "./conversation-model";
import { ActivitySummary } from "./ActivitySummary";

const item: ConversationViewItem = {
  id: "activity-summary",
  turnId: "turn-catalog",
  type: "commandExecution",
  category: "activity",
  title: "Run typecheck",
  text: "",
  metadata: { command: "pnpm typecheck", status: "inProgress" },
};

export const RunningCommand: Story = () => (
  <details className="collapse collapse-arrow mx-auto max-w-3xl border border-base-300 bg-base-100" open>
    <ActivitySummary item={item} presentation={getActivityPresentation(item.type)} />
  </details>
);
