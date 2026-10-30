import type { ComponentType, ReactNode, SVGProps } from "react";

export type StateBadgeTone =
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral";

const toneClasses: Record<StateBadgeTone, string> = {
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
  info: "badge-info",
  neutral: "badge-ghost",
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
  return (
    <span className={`badge gap-1 ${toneClasses[tone]}`} role="status">
      {Icon && <Icon aria-hidden="true" className="size-3.5" />}
      {children}
    </span>
  );
}
