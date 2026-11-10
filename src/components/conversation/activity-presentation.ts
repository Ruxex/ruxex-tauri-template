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
  typeLabel: string;
};

const activityPresentations: Record<string, ActivityPresentation> = {
  commandExecution: {
    icon: CommandLineIcon,
    label: "Command",
    typeLabel: "Command execution",
  },
  dynamicToolCall: {
    icon: WrenchScrewdriverIcon,
    label: "Tool",
    typeLabel: "Tool call",
  },
  mcpToolCall: {
    icon: ServerStackIcon,
    label: "MCP tool",
    typeLabel: "MCP tool call",
  },
  fileChange: {
    icon: DocumentCheckIcon,
    label: "File changes",
    typeLabel: "File changes",
  },
  plan: { icon: ClipboardDocumentListIcon, label: "Plan", typeLabel: "Plan" },
  reasoning: {
    icon: LightBulbIcon,
    label: "Reasoning",
    typeLabel: "Reasoning",
  },
  imageView: {
    icon: PhotoIcon,
    label: "Screenshot",
    typeLabel: "Screenshot",
  },
  collabAgentToolCall: {
    icon: UserGroupIcon,
    label: "Agent collaboration",
    typeLabel: "Agent collaboration",
  },
};

const fallbackPresentation: ActivityPresentation = {
  icon: BoltIcon,
  label: "Activity",
  typeLabel: "Activity",
};

export function getActivityPresentation(type: string): ActivityPresentation {
  return activityPresentations[type] ?? fallbackPresentation;
}
