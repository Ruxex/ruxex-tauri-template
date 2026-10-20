import type { ReactNode } from "react";
import type { UiDensity, UiTheme } from "../../app/ui-preferences";

type ConnectionCardProps = {
  connected: boolean;
  appServerVersion?: string;
  resynchronizing: boolean;
  error?: unknown;
  isFetching: boolean;
  onReconnect: () => void;
};

export function ConnectionCard({
  connected,
  appServerVersion,
  resynchronizing,
  error,
  isFetching,
  onReconnect,
}: ConnectionCardProps) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title">Connection</h2>
        <dl className="grid gap-2 text-sm">
          <SettingRow label="Status">{connected ? "Connected" : "Disconnected"}</SettingRow>
          <SettingRow label="App-server">{appServerVersion ?? "Unavailable"}</SettingRow>
          <SettingRow label="Live state">
            {resynchronizing ? "Resynchronizing" : "Synchronized"}
          </SettingRow>
        </dl>
        {error !== undefined && error !== null && (
          <p className="mt-2 text-sm text-error">{String(error)}</p>
        )}
        <button
          className="btn btn-sm self-end"
          type="button"
          onClick={onReconnect}
          disabled={isFetching}
        >
          {isFetching ? "Reconnecting…" : "Reconnect"}
        </button>
      </div>
    </section>
  );
}

type ProviderAccountCardProps = {
  provider: string;
  authStatus: string;
  account: string;
};

export function ProviderAccountCard({
  provider,
  authStatus,
  account,
}: ProviderAccountCardProps) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title">Provider and account</h2>
        <dl className="grid gap-2 text-sm">
          <SettingRow label="Provider">{provider}</SettingRow>
          <SettingRow label="Auth">{authStatus}</SettingRow>
          <SettingRow label="Account">{account}</SettingRow>
        </dl>
      </div>
    </section>
  );
}

export function CapabilitiesCard({
  capabilities,
}: {
  capabilities: Record<string, boolean | string>;
}) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title">Capabilities</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(capabilities).map(([name, enabled]) => (
            <div className="flex justify-between gap-3" key={name}>
              <span>{name}</span>
              <span className={enabled ? "text-success" : "text-base-content/50"}>
                {String(enabled)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type RuntimeSummaryProps = {
  modelCount: number;
  permissionCount: number;
  rateLimitName: string;
};

export function RuntimeSummary({
  modelCount,
  permissionCount,
  rateLimitName,
}: RuntimeSummaryProps) {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      <SummaryCard label="Models">{modelCount} available</SummaryCard>
      <SummaryCard label="Permissions">{permissionCount} profiles</SummaryCard>
      <SummaryCard label="Rate limits">{rateLimitName}</SummaryCard>
    </section>
  );
}

type UiPreferencesCardProps = {
  theme: UiTheme;
  density: UiDensity;
  sidebarCollapsed: boolean;
  contextDrawerOpen: boolean;
  onThemeChange: (theme: UiTheme) => void;
  onDensityChange: (density: UiDensity) => void;
  onSidebarChange: (collapsed: boolean) => void;
  onContextDrawerChange: (open: boolean) => void;
};

export function UiPreferencesCard({
  theme,
  density,
  sidebarCollapsed,
  contextDrawerOpen,
  onThemeChange,
  onDensityChange,
  onSidebarChange,
  onContextDrawerChange,
}: UiPreferencesCardProps) {
  return (
    <section className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div>
          <h2 className="card-title">Interface</h2>
          <p className="text-sm text-base-content/70">These are local presentation preferences only.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="form-control">
            <span className="label-text">Theme</span>
            <select className="select select-bordered select-sm mt-1" value={theme} onChange={(event) => onThemeChange(event.target.value as UiTheme)}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text">Density</span>
            <select className="select select-bordered select-sm mt-1" value={density} onChange={(event) => onDensityChange(event.target.value as UiDensity)}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </div>
        <label className="label cursor-pointer justify-start gap-3">
          <input className="toggle" type="checkbox" checked={!sidebarCollapsed} onChange={(event) => onSidebarChange(!event.target.checked)} />
          <span className="label-text">Show project sidebar</span>
        </label>
        <label className="label cursor-pointer justify-start gap-3">
          <input className="toggle" type="checkbox" checked={contextDrawerOpen} onChange={(event) => onContextDrawerChange(event.target.checked)} />
          <span className="label-text">Show context drawer</span>
        </label>
      </div>
    </section>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SummaryCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base">{label}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}
