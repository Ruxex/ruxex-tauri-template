import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

export type StateBadgeTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

const iconToneClasses: Record<StateBadgeTone, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-info",
  neutral: "text-base-content/60",
};

const defaultIcons: Record<
  StateBadgeTone,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
  neutral: InformationCircleIcon,
};

export function StateBadge({
  children,
  icon: Icon,
  tone,
}: {
  children: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  tone: StateBadgeTone;
}) {
  const BadgeIcon = Icon ?? defaultIcons[tone];

  return (
    <span className="inline-flex items-center gap-1 text-sm" role="status">
      <BadgeIcon
        aria-hidden="true"
        className={`size-3.5 shrink-0 ${iconToneClasses[tone]}`}
      />
      {children}
    </span>
  );
}
