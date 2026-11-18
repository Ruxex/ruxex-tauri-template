import type { Story } from "@ladle/react";

import { CatalogSurface } from "../../../../.ladle/support/catalog-providers";
import type { ConversationViewItem } from "./conversation-model";
import { ActivityDetails } from "./ActivityDetails";

const item: ConversationViewItem = {
  id: "activity-details",
  turnId: "turn-catalog",
  type: "commandExecution",
  category: "activity",
  title: "Run checks",
  text: "All checks passed.",
  metadata: {
    command: "pnpm check:catalog",
    cwd: "/workspace/ruxex",
    status: "completed",
    exitCode: "0",
  },
};

export const CommandAndMetadata: Story = () => (
  <CatalogSurface>
    <ActivityDetails item={item} />
  </CatalogSurface>
);
