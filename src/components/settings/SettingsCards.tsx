import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  BellIcon,
  CpuChipIcon,
  GlobeAltIcon,
  LinkIcon,
  PaintBrushIcon,
  ServerStackIcon,
  SparklesIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import type {
  UiAccentColor,
  UiColorScheme,
  UiDensity,
  UiLanguage,
  UiTheme,
} from "../../app/ui-preferences";
import { formatErrorMessage } from "../../app/error-message";

type SettingsPanelIcon = ComponentType<SVGProps<SVGSVGElement>>;

const settingsPanelIcons: Record<string, SettingsPanelIcon> = {
  Connection: LinkIcon,
  "Provider and account": UserCircleIcon,
  Capabilities: SparklesIcon,
  "Runtime summary": CpuChipIcon,
  Language: GlobeAltIcon,
  Notifications: BellIcon,
  Interface: PaintBrushIcon,
  "Remote App Server": ServerStackIcon,
};

export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const Icon = settingsPanelIcons[title];

  return (
    <section className="overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
      <div className="border-b border-base-300 px-5 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          {Icon && <Icon aria-hidden="true" className="size-5 text-primary" />}
          {title}
        </h2>
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
        <p className="px-5 py-3 text-sm text-error">
          {formatErrorMessage(error)}
        </p>
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

export function LanguageCard({
  language,
  onLanguageChange,
}: {
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
}) {
  return (
    <SettingsPanel title="Language">
      <div className="text-sm">
        <SettingControlRow controlId="settings-language" label="Language">
          <select
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-language"
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as UiLanguage)
            }
          >
            <option value="system">System default</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </SettingControlRow>
      </div>
    </SettingsPanel>
  );
}

export function NotificationsCard({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <SettingsPanel
      title="Notifications"
      description="Control desktop notifications when the app is in the background."
    >
      <div className="text-sm">
        <SettingControlRow
          controlId="settings-desktop-notifications"
          label="Desktop notifications"
        >
          <input
            className="toggle justify-self-end"
            checked={enabled}
            id="settings-desktop-notifications"
            onChange={(event) => onEnabledChange(event.target.checked)}
            type="checkbox"
          />
        </SettingControlRow>
      </div>
    </SettingsPanel>
  );
}

type UiPreferencesCardProps = {
  colorScheme: UiColorScheme;
  theme: UiTheme;
  density: UiDensity;
  onColorSchemeChange: (colorScheme: UiColorScheme) => void;
  onAccentColorChange: (accentColor: UiAccentColor) => void;
  onDensityChange: (density: UiDensity) => void;
};

export function UiPreferencesCard({
  colorScheme,
  theme,
  density,
  onColorSchemeChange,
  onAccentColorChange,
  onDensityChange,
}: UiPreferencesCardProps) {
  return (
    <SettingsPanel
      title="Interface"
      description="These are local presentation preferences only."
    >
      <div className="divide-y divide-base-300 text-sm">
        <SettingControlRow controlId="settings-color-scheme" label="Color mode">
          <select
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-color-scheme"
            value={colorScheme}
            onChange={(event) =>
              onColorSchemeChange(event.target.value as UiColorScheme)
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </SettingControlRow>
        <SettingControlRow controlId="settings-theme" label="Theme">
          <select
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-theme"
            value={theme.accentColor}
            onChange={(event) =>
              onAccentColorChange(event.target.value as UiAccentColor)
            }
          >
            <option value="blue">Blue</option>
            <option value="violet">Violet</option>
            <option value="emerald">Emerald</option>
            <option value="amber">Amber</option>
            <option value="rose">Rose</option>
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
