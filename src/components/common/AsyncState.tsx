import type { ComponentType, ReactNode, SVGProps } from "react";

export function LoadingState({ size = "lg" }: { size?: "sm" | "lg" }) {
  return <span className={`loading loading-spinner loading-${size}`} />;
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <p className="alert alert-error" role="alert">
      {children}
    </p>
  );
}

export function EmptyState({
  action,
  compact = false,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  compact?: boolean;
  description?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-base-300 bg-base-100/50 text-center ${compact ? "px-3 py-4" : "px-6 py-10"}`}
    >
      {Icon && (
        <Icon
          aria-hidden="true"
          className={`mx-auto text-base-content/35 ${compact ? "size-6" : "size-8"}`}
        />
      )}
      <h3 className={`${compact ? "mt-2 text-sm" : "mt-3"} font-semibold`}>
        {title}
      </h3>
      {action && <div className={compact ? "mt-2" : "mt-4"}>{action}</div>}
    </div>
  );
}
