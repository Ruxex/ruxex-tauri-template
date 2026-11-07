import type { ComponentType, ReactNode, SVGProps } from "react";

export function LoadingState({ size = "lg" }: { size?: "sm" | "lg" }) {
  return <span className={`loading loading-spinner loading-${size}`} />;
}

export function ErrorState({ children }: { children: ReactNode }) {
  return <p className="alert alert-error">{children}</p>;
}

export function EmptyState({
  children,
  action,
  description,
  icon: Icon,
  title,
}: {
  children?: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title?: ReactNode;
}) {
  if (title === undefined) {
    return <p className="text-base-content/60">{children}</p>;
  }

  return (
    <div className="rounded-xl border border-dashed border-base-300 bg-base-100/50 px-6 py-10 text-center">
      {Icon && (
        <Icon
          aria-hidden="true"
          className="mx-auto size-8 text-base-content/35"
        />
      )}
      <h3 className="mt-3 font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-base-content/60">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
