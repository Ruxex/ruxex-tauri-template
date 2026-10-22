import type { ComponentType, SVGProps } from "react";

import {
  ArrowPathIcon,
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

import type { ConversationViewItem } from "./conversation-model";
import { ImageView } from "./ImageView";
import { MarkdownContent } from "./MarkdownContent";
import { openBrowserWindow } from "../../platform/native";

type ActivityIcon = ComponentType<SVGProps<SVGSVGElement>>;

type ActivityPresentation = {
  icon: ActivityIcon;
  label: string;
};

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

export function ActivityItem({ item }: { item: ConversationViewItem }) {
  const presentation = activityPresentations[item.type] ?? fallbackPresentation;
  const isInProgress =
    item.metadata?.status === "inProgress" ||
    item.metadata?.status === "running";
  const Icon = presentation.icon;

  return (
    <details className="collapse collapse-arrow border border-base-300 bg-base-100">
      <summary className="collapse-title flex items-center gap-2 py-3 text-sm font-medium">
        <span
          aria-label={presentation.label}
          className="inline-flex shrink-0"
          role="img"
          title={presentation.label}
        >
          <Icon aria-hidden="true" className="size-4 text-base-content/70" />
          {isInProgress && (
            <ArrowPathIcon
              aria-hidden="true"
              className="size-3 animate-spin text-primary"
            />
          )}
        </span>
        <span>{item.title}</span>
        <span className="badge badge-ghost badge-sm">{item.type}</span>
        {isInProgress && (
          <span aria-label="Running" className="sr-only" role="status">
            Running
          </span>
        )}
      </summary>
      <div className="collapse-content">
        {item.imagePath && <ImageView path={item.imagePath} />}
        {item.imageUrls?.map((url) => (
          <ImageView key={url} url={url} />
        ))}
        {item.browserUrl && (
          <button
            className="btn btn-sm btn-outline mb-3"
            onClick={() => void openBrowserWindow(item.browserUrl ?? "")}
            type="button"
          >
            Open in browser
          </button>
        )}
        {item.metadata && (
          <dl className="mb-3 grid gap-x-4 gap-y-1 text-xs text-base-content/60 sm:grid-cols-2">
            {Object.entries(item.metadata).map(([key, value]) => (
              <div className="flex min-w-0 gap-2" key={key}>
                <dt className="shrink-0 font-medium">{key}</dt>
                <dd className="truncate" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <MarkdownContent text={item.text || "…"} />
      </div>
    </details>
  );
}
