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
import type { TFunction } from "i18next";
import type { ComponentType, SVGProps } from "react";

import { i18n } from "../../app/i18n";

type ActivityIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type ActivityPresentation = {
  icon: ActivityIcon;
  label: string;
  typeLabel: string;
};

type ActivityPresentationKeys = {
  icon: ActivityIcon;
  labelKey: string;
  typeLabelKey: string;
};

const activityPresentations: Record<string, ActivityPresentationKeys> = {
  commandExecution: {
    icon: CommandLineIcon,
    labelKey: "command",
    typeLabelKey: "commandExecution",
  },
  dynamicToolCall: {
    icon: WrenchScrewdriverIcon,
    labelKey: "tool",
    typeLabelKey: "toolCall",
  },
  mcpToolCall: {
    icon: ServerStackIcon,
    labelKey: "mcpTool",
    typeLabelKey: "mcpToolCall",
  },
  fileChange: {
    icon: DocumentCheckIcon,
    labelKey: "fileChanges",
    typeLabelKey: "fileChanges",
  },
  plan: {
    icon: ClipboardDocumentListIcon,
    labelKey: "plan",
    typeLabelKey: "plan",
  },
  reasoning: {
    icon: LightBulbIcon,
    labelKey: "reasoning",
    typeLabelKey: "reasoning",
  },
  imageView: {
    icon: PhotoIcon,
    labelKey: "screenshot",
    typeLabelKey: "screenshot",
  },
  collabAgentToolCall: {
    icon: UserGroupIcon,
    labelKey: "agentCollaboration",
    typeLabelKey: "agentCollaboration",
  },
};

const fallbackPresentation: ActivityPresentationKeys = {
  icon: BoltIcon,
  labelKey: "activity",
  typeLabelKey: "activity",
};

export function getActivityPresentation(
  type: string,
  t: TFunction = i18n.getFixedT(null, "conversation"),
): ActivityPresentation {
  const presentation = activityPresentations[type] ?? fallbackPresentation;
  return {
    icon: presentation.icon,
    label: t(presentation.labelKey),
    typeLabel: t(presentation.typeLabelKey),
  };
}
