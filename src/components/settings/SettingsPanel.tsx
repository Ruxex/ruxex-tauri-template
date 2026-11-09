import type { ComponentType, ReactNode, SVGProps } from "react";

export type SettingsPanelIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function SettingsPanel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: SettingsPanelIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-5 py-4">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
          {Icon && <Icon aria-hidden="true" className="size-5 text-primary" />}
          {title}
        </h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="divide-y divide-base-300">{children}</div>
    </section>
  );
}

export function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 max-sm:grid-cols-1 max-sm:items-start">
      <dt className="min-w-0">{label}</dt>
      <dd className="min-w-0 w-full max-w-full justify-self-end text-right">
        {children}
      </dd>
    </div>
  );
}
