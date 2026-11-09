import { memo, type ComponentType, type SVGProps } from "react";

import {
  BoltIcon,
  ClipboardDocumentListIcon,
  CommandLineIcon,
  DocumentCheckIcon,
  LightBulbIcon,
  PhotoIcon,
  ServerStackIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

import {
  areConversationViewItemsEqual,
  type ConversationViewItem,
} from "./conversation-model";
import { CommandExecutionView } from "./CommandExecutionView";
import { ArtifactPreview } from "./ArtifactPreview";
import { ExecutionStatusIcon } from "./ExecutionStatusIcon";
import { ImageView } from "./ImageView";
import { MarkdownContent } from "./MarkdownContent";
import {
  openBrowserWindow,
  type ArtifactPreviewData,
} from "../../platform/native";

type ActivityIcon = ComponentType<SVGProps<SVGSVGElement>>;

type ActivityPresentation = {
  icon: ActivityIcon;
  label: string;
};

const previewableArtifactFormats = new Set(["xlsx", "docx", "pptx"]);

const activityPresentations: Record<string, ActivityPresentation> = {
  commandExecution: { icon: CommandLineIcon, label: "Command" },
  dynamicToolCall: { icon: WrenchScrewdriverIcon, label: "Tool" },
  mcpToolCall: { icon: ServerStackIcon, label: "MCP tool" },
  fileChange: { icon: DocumentCheckIcon, label: "File changes" },
  plan: { icon: ClipboardDocumentListIcon, label: "Plan" },
  reasoning: { icon: LightBulbIcon, label: "Reasoning" },
  imageView: { icon: PhotoIcon, label: "Screenshot" },
  collabAgentToolCall: { icon: UserGroupIcon, label: "Agent collaboration" },
};

const fallbackPresentation: ActivityPresentation = {
  icon: BoltIcon,
  label: "Activity",
};

type ActivityItemProps = {
  item: ConversationViewItem;
  loadArtifactPreview?: (path: string) => Promise<ArtifactPreviewData>;
};

export const ActivityItem = memo(
  function ActivityItem({ item, loadArtifactPreview }: ActivityItemProps) {
    const presentation =
      activityPresentations[item.type] ?? fallbackPresentation;
    const isInProgress =
      item.metadata?.status === "inProgress" ||
      item.metadata?.status === "running";
    const isCommandExecution = item.type === "commandExecution";
    const command = isCommandExecution ? item.metadata?.command : undefined;
    const metadataEntries = Object.entries(item.metadata ?? {}).filter(
      ([key]) =>
        !isCommandExecution ||
        !["command", "cwd", "status", "exitCode"].includes(key),
    );
    const Icon = presentation.icon;

    return (
      <details className="collapse collapse-arrow border border-base-300 bg-base-100">
        <summary className="collapse-title flex items-center gap-2 py-3 text-sm font-medium">
          <span
            aria-label={presentation.label}
            className="inline-flex size-4 shrink-0 items-center justify-center"
            role="img"
            title={presentation.label}
          >
            <Icon aria-hidden="true" className="size-4 text-base-content/70" />
          </span>
          <span>{item.title}</span>
          {isCommandExecution && item.metadata?.status && (
            <ExecutionStatusIcon status={item.metadata.status} />
          )}
          {!isCommandExecution && isInProgress && (
            <ExecutionStatusIcon status={item.metadata?.status} />
          )}
          {isInProgress && (
            <span aria-label="Running" className="sr-only" role="status">
              Running
            </span>
          )}
          <span className="badge badge-ghost badge-sm">{item.type}</span>
        </summary>
        <div className="collapse-content">
          {item.imagePath && <ImageView path={item.imagePath} />}
          {item.imageUrls?.map((url) => (
            <ImageView key={url} url={url} />
          ))}
          {item.browserUrl && (
            <button
              aria-label="Open in browser"
              className="btn btn-sm btn-outline mb-3"
              onClick={() => void openBrowserWindow(item.browserUrl ?? "")}
              type="button"
            >
              Open in browser
            </button>
          )}
          {item.artifactPath &&
            item.artifactFormat &&
            previewableArtifactFormats.has(item.artifactFormat) && (
            <ArtifactPreview
              loadPreview={loadArtifactPreview}
              path={item.artifactPath}
            />
          )}
          {isCommandExecution && command && (
            <CommandExecutionView
              command={command}
              exitCode={item.metadata?.exitCode}
              result={item.text}
              status={item.metadata?.status}
            />
          )}
          {metadataEntries.length > 0 && (
            <dl className="mb-3 grid gap-x-4 gap-y-1 text-xs text-base-content/60 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div className="flex min-w-0 gap-2" key={key}>
                  <dt className="shrink-0 font-medium">{key}</dt>
                  <dd className="truncate" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {!(isCommandExecution && command) && (
            <MarkdownContent text={item.text || "…"} />
          )}
        </div>
      </details>
    );
  },
    (left, right) =>
      areConversationViewItemsEqual(left.item, right.item) &&
      left.loadArtifactPreview === right.loadArtifactPreview,
);
