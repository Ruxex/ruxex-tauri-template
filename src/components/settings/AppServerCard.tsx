import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
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
  if (
    normalized === "running" ||
    normalized === "connected" ||
    normalized === "alreadyrunning" ||
    normalized === "started" ||
    normalized === "restarted"
  ) {
    return "success";
  }
  if (normalized === "unavailable" || normalized === "failed") {
    return "error";
  }
  return "warning";
}

function isDaemonRunningStatus(status: string): boolean {
  return ["running", "alreadyRunning", "started", "restarted"].includes(status);
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
  isRefreshing,
  isUpdatePending,
  mode,
  onAction,
  onReconnect,
  onRefresh,
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
  isRefreshing: boolean;
  isUpdatePending: boolean;
  mode?: "daemon" | "inprocess";
  onAction: (action: Exclude<AppServerDaemonAction, "version">) => void;
  onReconnect: () => void;
  onRefresh: () => void;
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
  const daemonStatus = daemon?.status ?? "unavailable";
  const daemonRunning =
    showDaemonControls && isDaemonRunningStatus(daemonStatus);
  const daemonStatusLabel = daemonStatus
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
  const displayedVersion = appServerVersion ?? daemon?.appServerVersion;
  const needsUpdate = Boolean(
    showDaemonControls &&
      displayedVersion &&
      daemon?.managedRuxexVersion &&
      displayedVersion !== daemon.managedRuxexVersion,
  );
  const actionDisabled =
    isFetching || isRefreshing || isPending || isUpdatePending;

  return (
    <SettingsPanel
      action={
        <button
          aria-label="Refresh"
          className="btn btn-ghost btn-sm btn-square"
          disabled={isFetching || isRefreshing || isPending || isUpdatePending}
          title="Refresh App Server status"
          type="button"
          onClick={onRefresh}
        >
          {isRefreshing ? (
            <span
              aria-hidden="true"
              className="loading loading-spinner loading-xs"
            />
          ) : (
            <ArrowPathIcon aria-hidden="true" className="size-4" />
          )}
        </button>
      }
      icon={ServerIcon}
      title="App Server"
    >
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
                disabled={
                  isUpdatePending || isPending || isRefreshing || isFetching
                }
                onClick={onUpdate}
                type="button"
              >
                {isUpdatePending && (
                  <span
                    aria-hidden="true"
                    className="loading loading-spinner loading-xs"
                  />
                )}
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
                {daemonStatusLabel}
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
        {daemonRunning && (
          <button
            aria-label="Reconnect"
            className="btn btn-sm btn-outline"
            type="button"
            onClick={onReconnect}
            disabled={
              isFetching || isRefreshing || isPending || isUpdatePending
            }
          >
            {isFetching && (
              <span
                aria-hidden="true"
                className="loading loading-spinner loading-xs"
              />
            )}
            Reconnect
          </button>
        )}
        {showDaemonControls && daemonRunning && (
          <>
            <button
              aria-label="Restart"
              className="btn btn-sm btn-outline btn-warning"
              disabled={actionDisabled}
              onClick={() => onAction("restart")}
              type="button"
            >
              {isPending && (
                <span
                  aria-hidden="true"
                  className="loading loading-spinner loading-xs"
                />
              )}
              Restart
            </button>
            <div className="join">
              <button
                aria-label="Stop"
                className="btn btn-sm join-item btn-outline btn-error"
                disabled={actionDisabled}
                onClick={() => onAction("stop")}
                type="button"
              >
                {isPending && (
                  <span
                    aria-hidden="true"
                    className="loading loading-spinner loading-xs"
                  />
                )}
                Stop
              </button>
              <details className="dropdown dropdown-end">
                <summary
                  aria-disabled={actionDisabled}
                  aria-label="Stop options"
                  className={`btn btn-sm join-item list-none btn-outline btn-error ${actionDisabled ? "pointer-events-none" : ""}`}
                >
                  <ChevronDownIcon aria-hidden="true" className="size-4" />
                </summary>
                <ul className="menu dropdown-content z-20 mt-2 w-36 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
                  <li>
                    <button
                      aria-label="Force stop"
                      disabled={actionDisabled}
                      onClick={(event) => {
                        onAction("forceStop");
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                      }}
                      role="menuitem"
                      type="button"
                    >
                      {isPending && (
                        <span
                          aria-hidden="true"
                          className="loading loading-spinner loading-xs"
                        />
                      )}
                      Force stop
                    </button>
                  </li>
                </ul>
              </details>
            </div>
          </>
        )}
        {showDaemonControls && !daemonRunning && (
          <button
            aria-label="Start"
            className="btn btn-sm btn-outline btn-success"
            disabled={actionDisabled}
            onClick={() => onAction("start")}
            type="button"
          >
            {isPending && (
              <span
                aria-hidden="true"
                className="loading loading-spinner loading-xs"
              />
            )}
            Start
          </button>
        )}
      </div>
    </SettingsPanel>
  );
}
