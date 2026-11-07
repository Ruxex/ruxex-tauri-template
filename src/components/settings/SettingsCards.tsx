import {
  Bars3BottomLeftIcon,
  BellIcon,
  CheckCircleIcon,
  CommandLineIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  PaintBrushIcon,
  ServerIcon,
  SparklesIcon,
  UserCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import type {
  ComponentType,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  SVGProps,
} from "react";
import { formatErrorMessage } from "../../app/error-message";
import type {
  UiAccentColor,
  UiColorScheme,
  UiFontSize,
  UiLanguage,
  UiNotificationSound,
  UiTheme,
} from "../../app/ui-preferences";
import {
  clampUiFontSize,
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
  UI_NOTIFICATION_SOUND_OPTIONS,
} from "../../app/ui-preferences";
import type {
  AppServerDaemonAction,
  AppServerDaemonOutput,
} from "../../app-server/daemon-api";
import { CapabilityStatus } from "../common/CapabilityStatus";
import { StateBadge, type StateBadgeTone } from "../common/StateBadge";

export type SettingsPanelIcon = ComponentType<SVGProps<SVGSVGElement>>;

function appServerStatusTone(status: string): StateBadgeTone {
  const normalized = status.toLowerCase();
  if (normalized === "running" || normalized === "connected") {
    return "success";
  }
  if (normalized === "unavailable" || normalized === "failed") {
    return "error";
  }
  return "warning";
}

export function SettingsPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
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
  isUpdatePending,
  mode,
  onAction,
  onReconnect,
  onUpdate,
  resynchronizing,
  updateError,
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
  isUpdatePending: boolean;
  mode?: "daemon" | "inprocess";
  onAction: (action: Exclude<AppServerDaemonAction, "version">) => void;
  onReconnect: () => void;
  onUpdate: () => void;
  resynchronizing: boolean;
  updateError?: unknown;
}) {
  const inProcess = mode === "inprocess";
  const error =
    connectionError ??
    appServerError ??
    controlError ??
    updateError ??
    daemonError;
  const showDaemonControls = !inProcess && isAvailable;
  const modeLabel = inProcess
    ? "InProcess mode"
    : appServerReady && appServerError == null
      ? "Daemon mode"
      : "Unavailable";
  const modeTone: StateBadgeTone = inProcess
    ? "info"
    : appServerReady && appServerError == null
      ? "success"
      : "error";
  const daemonStatus = daemon?.status ?? "Unavailable";
  const displayedVersion = appServerVersion ?? daemon?.appServerVersion;
  const needsUpdate = Boolean(
    showDaemonControls &&
      displayedVersion &&
      daemon?.managedRuxexVersion &&
      displayedVersion !== daemon.managedRuxexVersion,
  );

  return (
    <SettingsPanel icon={ServerIcon} title="App Server">
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Mode">
          <StateBadge
            icon={modeTone === "error" ? XCircleIcon : InformationCircleIcon}
            tone={modeTone}
          >
            {modeLabel}
          </StateBadge>
        </SettingRow>
        <SettingRow label="Connection">
          <StateBadge
            icon={connected ? CheckCircleIcon : XCircleIcon}
            tone={connected ? "success" : "error"}
          >
            {connected ? "Connected" : "Disconnected"}
          </StateBadge>
        </SettingRow>
        <SettingRow label="Live state">
          <StateBadge
            icon={resynchronizing ? ExclamationTriangleIcon : CheckCircleIcon}
            tone={resynchronizing ? "warning" : "success"}
          >
            {resynchronizing ? "Resynchronizing" : "Synchronized"}
          </StateBadge>
        </SettingRow>
        <SettingRow label="App Server version">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span>{displayedVersion ?? "Unavailable"}</span>
            {needsUpdate && (
              <button
                aria-label={isUpdatePending ? "Updating…" : "Update"}
                className="btn btn-outline btn-xs"
                disabled={isUpdatePending || isPending}
                onClick={onUpdate}
                type="button"
              >
                {isUpdatePending ? "Updating…" : "Update"}
              </button>
            )}
          </div>
        </SettingRow>
        {inProcess ? (
          <SettingRow label="Status">
            <StateBadge icon={CheckCircleIcon} tone="success">
              Running in this process
            </StateBadge>
          </SettingRow>
        ) : (
          <>
            <SettingRow label="Status">
              <StateBadge
                icon={
                  appServerStatusTone(daemonStatus) === "success"
                    ? CheckCircleIcon
                    : ExclamationTriangleIcon
                }
                tone={appServerStatusTone(daemonStatus)}
              >
                {daemonStatus}
              </StateBadge>
            </SettingRow>
            {daemon?.pid !== undefined && (
              <SettingRow label="PID">{daemon.pid}</SettingRow>
            )}
            {daemon?.socketPath && (
              <SettingRow label="Socket">
                <span
                  className="block max-w-full truncate font-mono text-xs"
                  title={daemon.socketPath}
                >
                  {daemon.socketPath}
                </span>
              </SettingRow>
            )}
          </>
        )}
      </dl>
      {error !== undefined && error !== null && (
        <p className="px-5 py-3 text-sm text-error">
          {formatErrorMessage(error)}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2 px-5 py-4">
        <button
          aria-label={isFetching ? "Reconnecting…" : "Reconnect"}
          className="btn btn-sm btn-outline"
          type="button"
          onClick={onReconnect}
          disabled={isFetching}
        >
          {isFetching ? "Reconnecting…" : "Reconnect"}
        </button>
        {showDaemonControls &&
          (
            [
              ["start", "btn-outline btn-success"],
              ["restart", "btn-outline btn-warning"],
              ["stop", "btn-outline btn-error"],
            ] as const
          ).map(([action, variant]) => (
            <button
              aria-label={action[0].toUpperCase() + action.slice(1)}
              className={`btn btn-sm ${variant}`}
              disabled={isPending}
              key={action}
              onClick={() => onAction(action)}
              type="button"
            >
              {action[0].toUpperCase() + action.slice(1)}
            </button>
          ))}
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
    <SettingsPanel icon={UserCircleIcon} title="Provider and account">
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Provider">{provider}</SettingRow>
        <SettingRow label="Auth">
          <StateBadge
            icon={
              authStatus === "authenticated"
                ? CheckCircleIcon
                : ExclamationTriangleIcon
            }
            tone={authStatus === "authenticated" ? "success" : "warning"}
          >
            {authStatus}
          </StateBadge>
        </SettingRow>
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
          <SettingRow label={capabilityLabel(name)} key={name}>
            {typeof enabled === "boolean" ? (
              <CapabilityStatus
                label={enabled ? "Enabled" : "Disabled"}
                state={enabled ? "enabled" : "disabled"}
              />
            ) : (
              <CapabilityStatus state="unsupported" label={String(enabled)} />
            )}
          </SettingRow>
        ))}
      </dl>
    </SettingsPanel>
  );
}

const CAPABILITY_LABELS: Record<string, string> = {
  apiKeyModelDiscovery: "API key model discovery",
  commandAuth: "Command authorization",
  externalWebAccess: "External web access",
  historyNotes: "History notes",
  interactiveLogin: "Interactive login",
  modelListing: "Model listing",
  namespaceTools: "Namespace tools",
  remoteCompaction: "Remote compaction",
  standaloneWebSearch: "Standalone web search",
  streaming: "Streaming",
  usage: "Usage reporting",
  webSearch: "Web search",
  websocket: "WebSocket",
};

function capabilityLabel(name: string): string {
  return (
    CAPABILITY_LABELS[name] ??
    name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replace(/^./, (character) => character.toUpperCase())
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
            aria-label="Language"
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
    <SettingsPanel icon={BellIcon} title="Notifications">
      <div className="text-sm">
        <SettingControlRow
          controlId="settings-desktop-notifications"
          label="Desktop notifications"
        >
          <input
            aria-label="Desktop notifications"
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
            aria-label="Notification sound"
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

export function QuickPanelCard({
  defaultShortcut,
  disabled,
  error,
  isLoading,
  waylandNotice,
  onReset,
  onSave,
  onShortcutKeyDown,
  shortcut,
}: {
  defaultShortcut: string;
  disabled: boolean;
  error?: string | null;
  isLoading: boolean;
  waylandNotice: string;
  onReset: () => void;
  onSave: () => void;
  onShortcutKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  shortcut: string;
}) {
  return (
    <SettingsPanel icon={CommandLineIcon} title="Quick panel">
      <div className="text-sm">
        <SettingControlRow
          controlId="settings-quick-panel-shortcut"
          label="Global shortcut"
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-sm justify-self-end" />
          ) : (
            <div className="flex w-full max-w-sm justify-self-end gap-2 max-sm:max-w-none">
              <input
                aria-label="Quick panel shortcut"
                className="input input-bordered input-sm min-w-0 flex-1"
                disabled={disabled}
                id="settings-quick-panel-shortcut"
                onKeyDown={onShortcutKeyDown}
                placeholder="Press keys…"
                readOnly
                value={shortcut}
              />
            </div>
          )}
        </SettingControlRow>
        <p className="px-5 pb-3 text-xs text-base-content/60">
          {waylandNotice}
        </p>
        {!isLoading && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5">
            <span className="mr-auto text-xs text-base-content/60">
              Default: {defaultShortcut}
            </span>
            <button
              aria-label="Reset"
              className="btn btn-ghost btn-sm"
              disabled={disabled || shortcut === defaultShortcut}
              onClick={onReset}
              type="button"
            >
              Reset
            </button>
            <button
              aria-label={disabled ? "Saving…" : "Save"}
              className="btn btn-primary btn-sm"
              disabled={disabled || !shortcut.trim()}
              onClick={onSave}
              type="button"
            >
              {disabled ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="px-5 py-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </SettingsPanel>
  );
}

type UiPreferencesCardProps = {
  colorScheme: UiColorScheme;
  theme: UiTheme;
  onColorSchemeChange: (colorScheme: UiColorScheme) => void;
  onAccentColorChange: (accentColor: UiAccentColor) => void;
};

export function UiPreferencesCard({
  colorScheme,
  theme,
  onColorSchemeChange,
  onAccentColorChange,
}: UiPreferencesCardProps) {
  return (
    <SettingsPanel icon={PaintBrushIcon} title="Interface">
      <div className="divide-y divide-base-300 text-sm">
        <SettingControlRow controlId="settings-color-scheme" label="Color mode">
          <select
            aria-label="Color mode"
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
            aria-label="Theme"
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
      </div>
    </SettingsPanel>
  );
}

export function TypographyCard({
  chatFontSize,
  uiFontSize,
  onChatFontSizeChange,
  onUiFontSizeChange,
}: {
  chatFontSize: UiFontSize;
  uiFontSize: UiFontSize;
  onChatFontSizeChange: (fontSize: UiFontSize) => void;
  onUiFontSizeChange: (fontSize: UiFontSize) => void;
}) {
  return (
    <SettingsPanel icon={Bars3BottomLeftIcon} title="Typography">
      <div className="divide-y divide-base-300 text-sm">
        <SettingControlRow
          controlId="settings-chat-font-size"
          label="Chat font size"
        >
          <input
            aria-label="Chat font size"
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
            aria-label="UI font size"
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
