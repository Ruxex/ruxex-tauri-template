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
import type { ComponentType, SVGProps } from "react";

export type ActivityIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type ActivityPresentation = {
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

export function getActivityPresentation(type: string): ActivityPresentation {
  return activityPresentations[type] ?? fallbackPresentation;
}
