import { memo } from "react";

import {
  areConversationViewItemsEqual,
  type ConversationViewItem,
} from "./conversation-model";
import { ActivityDetails } from "./ActivityDetails";
import { ActivitySummary } from "./ActivitySummary";
import { getActivityPresentation } from "./activity-presentation";
import type { ArtifactPreviewData } from "../../platform/native";

type ActivityItemProps = {
  item: ConversationViewItem;
  loadArtifactPreview?: (path: string) => Promise<ArtifactPreviewData>;
};

export const ActivityItem = memo(
  function ActivityItem({ item, loadArtifactPreview }: ActivityItemProps) {
    const presentation = getActivityPresentation(item.type);
    const isCommandExecution = item.type === "commandExecution";

    return (
      <details
        className={`collapse collapse-arrow bg-base-100 ${isCommandExecution ? "" : "border border-base-300"}`}
      >
        <ActivitySummary item={item} presentation={presentation} />
        <div className="collapse-content">
          <ActivityDetails
            item={item}
            loadArtifactPreview={loadArtifactPreview}
          />
        </div>
      </details>
    );
  },
  (left, right) =>
    areConversationViewItemsEqual(left.item, right.item) &&
    left.loadArtifactPreview === right.loadArtifactPreview,
);
