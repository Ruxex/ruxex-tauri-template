import type { Story } from "@ladle/react";

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
});

export const Command: Story = () => <ActivityItem item={commandItem} />;

export const InProgress: Story = () => (
  <ActivityItem
    item={{
      ...commandItem,
      id: "activity-running",
      title: "Running checks",
      metadata: { ...commandItem.metadata, status: "inProgress" },
      text: "",
    }}
  />
);

export const ToolCall: Story = () => (
  <ActivityItem
    item={{
      ...commandItem,
      id: "activity-tool",
      type: "dynamicToolCall",
      title: "Inspect repository",
      text: '{"path":"/workspace/ruxex"}',
      metadata: {
        namespace: "filesystem",
        status: "completed",
        success: "true",
      },
    }}
  />
);

export const FileChanges: Story = () => (
  <ActivityItem
    item={{
      ...commandItem,
      id: "activity-files",
      type: "fileChange",
      title: "Update component styles",
      text: "src/components/Composer.tsx\nsrc/components/Sidebar.tsx",
      metadata: { files: "2", status: "completed" },
    }}
  />
);

export const Artifact: Story = () => (
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
);
