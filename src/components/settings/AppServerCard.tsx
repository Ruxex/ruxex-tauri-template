import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ServerIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { formatErrorMessage } from "../../app/error-message";
import type {
  AppServerDaemonAction,
  AppServerDaemonOutput,
} from "../../app-server/daemon-api";
import { StateBadge, type StateBadgeTone } from "../common/StateBadge";
import { SettingRow, SettingsPanel } from "./SettingsPanel";

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
              <SettingRow label="UnixSocket">
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
