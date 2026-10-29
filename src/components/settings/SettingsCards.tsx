import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  BellIcon,
  CpuChipIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  ServerIcon,
  SparklesIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import type {
  AppServerDaemonAction,
  AppServerDaemonOutput,
} from "../../app-server/daemon-api";
import type {
  UiAccentColor,
  UiColorScheme,
  UiFontSize,
  UiLanguage,
  UiNotificationSound,
  UiTheme,
} from "../../app/ui-preferences";
import {
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
  UI_NOTIFICATION_SOUND_OPTIONS,
  clampUiFontSize,
} from "../../app/ui-preferences";
import { formatErrorMessage } from "../../app/error-message";

export type SettingsPanelIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function SettingsPanel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: SettingsPanelIcon;
  children: ReactNode;
}) {
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

export function AppServerCard({
  appServerVersion,
  connected,
  connectionError,
  daemon,
  daemonError,
  controlError,
  appServerError,
  appServerReady,
  isAvailable,
  isFetching,
  isPending,
  mode,
  onAction,
  onReconnect,
  resynchronizing,
}: {
  appServerError?: unknown;
  appServerReady: boolean;
  appServerVersion?: string;
  connected: boolean;
  connectionError?: unknown;
  daemon?: AppServerDaemonOutput;
  daemonError?: unknown;
  controlError?: unknown;
  isAvailable: boolean;
  isFetching: boolean;
  isPending: boolean;
  mode?: "daemon" | "inprocess";
  onAction: (action: Exclude<AppServerDaemonAction, "version">) => void;
  onReconnect: () => void;
  resynchronizing: boolean;
}) {
  const inProcess = mode === "inprocess";
  const error =
    connectionError ?? appServerError ?? controlError ?? daemonError;
  const showDaemonControls = !inProcess && isAvailable;
  const modeLabel = inProcess
    ? "InProcess mode"
    : appServerReady && appServerError == null
      ? "Daemon mode"
      : "Unavailable";

  return (
    <SettingsPanel
      icon={ServerIcon}
      title="AppServer"
      description={
        inProcess
          ? "The Ruxex AppServer is running in this process."
          : appServerReady && appServerError == null
            ? "Control the managed Ruxex AppServer daemon."
            : "The Ruxex AppServer is unavailable. Retry daemon startup below."
      }
    >
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Mode">{modeLabel}</SettingRow>
        <SettingRow label="Connection">
          {connected ? "Connected" : "Disconnected"}
        </SettingRow>
        <SettingRow label="Live state">
          {resynchronizing ? "Resynchronizing" : "Synchronized"}
        </SettingRow>
        <SettingRow label="AppServer version">
          {appServerVersion ?? daemon?.appServerVersion ?? "Unavailable"}
        </SettingRow>
        {inProcess ? (
          <SettingRow label="Status">Running in this process</SettingRow>
        ) : (
          <>
            <SettingRow label="Status">
              {daemon?.status ?? "Unavailable"}
            </SettingRow>
            <SettingRow label="PID">{daemon?.pid ?? "Unavailable"}</SettingRow>
            <SettingRow label="Socket">
              {daemon?.socketPath ?? "Unavailable"}
            </SettingRow>
          </>
        )}
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
      {showDaemonControls && (
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
          {(["start", "restart", "stop"] as const).map((action) => (
            <button
              className="btn btn-sm"
              disabled={isPending}
              key={action}
              onClick={() => onAction(action)}
              type="button"
            >
              {action[0].toUpperCase() + action.slice(1)}
            </button>
          ))}
        </div>
      )}
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
    <SettingsPanel icon={UserCircleIcon} title="Provider and account">
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
    <SettingsPanel icon={SparklesIcon} title="Capabilities">
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
    <SettingsPanel icon={CpuChipIcon} title="Runtime summary">
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
    <SettingsPanel icon={GlobeAltIcon} title="Language">
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
  sound,
  onSoundChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  sound: UiNotificationSound;
  onSoundChange: (sound: UiNotificationSound) => void;
}) {
  return (
    <SettingsPanel
      icon={BellIcon}
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
        <SettingControlRow
          controlId="settings-notification-sound"
          label="Notification sound"
        >
          <select
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-notification-sound"
            value={sound}
            onChange={(event) =>
              onSoundChange(event.target.value as UiNotificationSound)
            }
          >
            {UI_NOTIFICATION_SOUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SettingControlRow>
      </div>
    </SettingsPanel>
  );
}

type UiPreferencesCardProps = {
  colorScheme: UiColorScheme;
  theme: UiTheme;
  chatFontSize: UiFontSize;
  uiFontSize: UiFontSize;
  onColorSchemeChange: (colorScheme: UiColorScheme) => void;
  onAccentColorChange: (accentColor: UiAccentColor) => void;
  onChatFontSizeChange: (fontSize: UiFontSize) => void;
  onUiFontSizeChange: (fontSize: UiFontSize) => void;
};

export function UiPreferencesCard({
  colorScheme,
  theme,
  chatFontSize,
  uiFontSize,
  onColorSchemeChange,
  onAccentColorChange,
  onChatFontSizeChange,
  onUiFontSizeChange,
}: UiPreferencesCardProps) {
  return (
    <SettingsPanel
      icon={PaintBrushIcon}
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
        <SettingControlRow
          controlId="settings-chat-font-size"
          label="Chat font size"
        >
          <input
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-chat-font-size"
            max={UI_FONT_SIZE_MAX}
            min={UI_FONT_SIZE_MIN}
            onBlur={() => onChatFontSizeChange(clampUiFontSize(chatFontSize))}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onChatFontSizeChange(value);
            }}
            step="1"
            type="number"
            value={chatFontSize}
          />
        </SettingControlRow>
        <SettingControlRow
          controlId="settings-ui-font-size"
          label="UI font size"
        >
          <input
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-ui-font-size"
            max={UI_FONT_SIZE_MAX}
            min={UI_FONT_SIZE_MIN}
            onBlur={() => onUiFontSizeChange(clampUiFontSize(uiFontSize))}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onUiFontSizeChange(value);
            }}
            step="1"
            type="number"
            value={uiFontSize}
          />
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
