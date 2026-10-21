import type { ReactNode } from "react";
import type { UiDensity, UiTheme } from "../../app/ui-preferences";

export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
      <div className="border-b border-base-300 px-5 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-base-content/70">{description}</p>
        )}
      </div>
      <div className="divide-y divide-base-300">{children}</div>
    </section>
  );
}

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
    <SettingsPanel title="Connection">
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Status">
          {connected ? "Connected" : "Disconnected"}
        </SettingRow>
        <SettingRow label="App-server">
          {appServerVersion ?? "Unavailable"}
        </SettingRow>
        <SettingRow label="Live state">
          {resynchronizing ? "Resynchronizing" : "Synchronized"}
        </SettingRow>
      </dl>
      {error !== undefined && error !== null && (
        <p className="px-5 py-3 text-sm text-error">{String(error)}</p>
      )}
      <div className="flex justify-end px-5 py-4">
        <button
          className="btn btn-sm"
          type="button"
          onClick={onReconnect}
          disabled={isFetching}
        >
          {isFetching ? "Reconnecting…" : "Reconnect"}
        </button>
      </div>
    </SettingsPanel>
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
    <SettingsPanel title="Provider and account">
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Provider">{provider}</SettingRow>
        <SettingRow label="Auth">{authStatus}</SettingRow>
        <SettingRow label="Account">{account}</SettingRow>
      </dl>
    </SettingsPanel>
  );
}

export function CapabilitiesCard({
  capabilities,
}: {
  capabilities: Record<string, boolean | string>;
}) {
  return (
    <SettingsPanel title="Capabilities">
      <dl className="divide-y divide-base-300 text-sm">
        {Object.entries(capabilities).map(([name, enabled]) => (
          <SettingRow label={name} key={name}>
            <span
              className={`${enabled ? "text-success" : "text-base-content/50"} text-right`}
            >
              {String(enabled)}
            </span>
          </SettingRow>
        ))}
      </dl>
    </SettingsPanel>
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
    <SettingsPanel title="Runtime summary">
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Models">{modelCount} available</SettingRow>
        <SettingRow label="Permissions">{permissionCount} profiles</SettingRow>
        <SettingRow label="Rate limits">{rateLimitName}</SettingRow>
      </dl>
    </SettingsPanel>
  );
}

type UiPreferencesCardProps = {
  theme: UiTheme;
  density: UiDensity;
  onThemeChange: (theme: UiTheme) => void;
  onDensityChange: (density: UiDensity) => void;
};

export function UiPreferencesCard({
  theme,
  density,
  onThemeChange,
  onDensityChange,
}: UiPreferencesCardProps) {
  return (
    <SettingsPanel
      title="Interface"
      description="These are local presentation preferences only."
    >
      <div className="divide-y divide-base-300 text-sm">
        <SettingControlRow controlId="settings-theme" label="Theme">
          <select
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-theme"
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as UiTheme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </SettingControlRow>
        <SettingControlRow controlId="settings-density" label="Density">
          <select
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-density"
            value={density}
            onChange={(event) =>
              onDensityChange(event.target.value as UiDensity)
            }
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </SettingControlRow>
      </div>
    </SettingsPanel>
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

function SettingControlRow({
  controlId,
  label,
  children,
}: {
  controlId: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 max-sm:grid-cols-1 max-sm:items-start">
      <label className="label-text" htmlFor={controlId}>
        {label}
      </label>
      {children}
    </div>
  );
}
