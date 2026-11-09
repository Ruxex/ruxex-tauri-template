import type { Story } from "@ladle/react";

import { StoryVariantList } from "../../../.ladle/support/StoryVariantList";

import { ActivityItem } from "./ActivityItem";
import type { ConversationViewItem } from "./conversation-model";

const commandItem: ConversationViewItem = {
  id: "activity-command",
  turnId: "turn-catalog",
  type: "commandExecution",
  category: "activity",
  title: "Run checks",
  text: "All tests passed.",
  metadata: {
    command: "pnpm check",
    cwd: "/workspace/ruxex",
    status: "completed",
    exitCode: "0",
  },
};

const loadArtifactPreview = async () => ({
  mimeType: "image/svg+xml" as const,
  dataUrl:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='120'><rect width='100%' height='100%' fill='%23ffffff'/><text x='16' y='32' font-family='sans-serif' font-size='18'>Report preview</text><rect x='16' y='48' width='220' height='28' fill='%23f1f5f9'/><text x='24' y='68' font-family='sans-serif'>Ada</text><text x='180' y='68'>3</text></svg>",
  format: "xlsx" as const,
  sheets: 1,
  rows: 3,
  columns: 2,
  byteSize: 128,
  pages: [],
  diagnostics: [],
});

export const States: Story = () => (
  <StoryVariantList
    variants={[
      {
        content: <ActivityItem item={commandItem} />,
        label: "Completed · exit code 0",
      },
      {
        content: (
          <ActivityItem
            item={{
              ...commandItem,
              id: "activity-running",
              title: "Running checks",
              metadata: { ...commandItem.metadata, status: "inProgress" },
              text: "",
            }}
          />
        ),
        label: "In progress",
      },
      {
        content: (
          <ActivityItem
            item={{
              ...commandItem,
              id: "activity-failed",
              title: "Checks failed",
              text: "One assertion failed.",
              metadata: {
                ...commandItem.metadata,
                status: "failed",
                exitCode: "1",
              },
            }}
          />
        ),
        label: "Failed · exit code 1",
      },
      {
        content: (
          <ActivityItem
            item={{
              ...commandItem,
              id: "activity-artifact",
              title: "Generate report",
              text: '{"ok":true,"format":"xlsx","output":"/workspace/report.xlsx"}',
              artifactPath: "/workspace/report.xlsx",
              artifactFormat: "xlsx",
            }}
            loadArtifactPreview={loadArtifactPreview}
          />
        ),
        label: "Artifact",
      },
    ]}
  />
);
