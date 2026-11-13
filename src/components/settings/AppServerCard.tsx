import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ServerIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import { formatErrorMessage } from "../../app/error-message";
import type {
  AppServerDaemonAction,
  AppServerDaemonOutput,
} from "../../app-server/daemon-api";
import { DialogFooter, DialogHeader } from "../common/DialogParts";
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
  const [stopAction, setStopAction] = useState<"stop" | "forceStop">("stop");
  const [confirmationAction, setConfirmationAction] = useState<
    "restart" | "stop" | "forceStop" | null
  >(null);
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
      allowOverflow
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
              onClick={() => setConfirmationAction("restart")}
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
                aria-label={stopAction === "stop" ? "Stop" : "Force stop"}
                className="btn btn-sm join-item btn-outline btn-error"
                disabled={actionDisabled}
                onClick={() => setConfirmationAction(stopAction)}
                type="button"
              >
                {isPending && (
                  <span
                    aria-hidden="true"
                    className="loading loading-spinner loading-xs"
                  />
                )}
                {stopAction === "stop" ? "Stop" : "Force stop"}
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
                  <li className={stopAction === "stop" ? "menu-active" : ""}>
                    <button
                      aria-checked={stopAction === "stop"}
                      disabled={actionDisabled}
                      onClick={(event) => {
                        setStopAction("stop");
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                      }}
                      role="menuitemradio"
                      type="button"
                    >
                      Stop
                    </button>
                  </li>
                  <li
                    className={stopAction === "forceStop" ? "menu-active" : ""}
                  >
                    <button
                      aria-checked={stopAction === "forceStop"}
                      disabled={actionDisabled}
                      onClick={(event) => {
                        setStopAction("forceStop");
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                      }}
                      role="menuitemradio"
                      type="button"
                    >
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
      {confirmationAction !== null && (
        <dialog
          aria-labelledby="app-server-action-title"
          aria-modal="true"
          className="modal"
          open
          onCancel={(event) => {
            event.preventDefault();
            setConfirmationAction(null);
          }}
        >
          <div className="modal-box w-full max-w-md px-5 py-6">
            <DialogHeader
              icon={ExclamationTriangleIcon}
              titleId="app-server-action-title"
              title={
                confirmationAction === "restart"
                  ? "Restart App Server?"
                  : confirmationAction === "forceStop"
                    ? "Force stop App Server?"
                    : "Stop App Server?"
              }
            />
            <p className="-mt-2 text-sm text-base-content/70">
              {confirmationAction === "restart"
                ? "Restarting will briefly interrupt active connections."
                : confirmationAction === "forceStop"
                  ? "Force stopping will immediately terminate the App Server."
                  : "Stopping will interrupt active connections."}
            </p>
            <DialogFooter>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setConfirmationAction(null)}
              >
                Cancel
              </button>
              <button
                className={`btn ${confirmationAction === "restart" ? "btn-warning" : "btn-error"}`}
                disabled={actionDisabled}
                type="button"
                onClick={() => {
                  onAction(confirmationAction);
                  setConfirmationAction(null);
                }}
              >
                {confirmationAction === "restart"
                  ? "Restart"
                  : confirmationAction === "forceStop"
                    ? "Force stop"
                    : "Stop"}
              </button>
            </DialogFooter>
          </div>
          <form className="modal-backdrop" method="dialog">
            <button
              aria-label="Close confirmation"
              type="button"
              onClick={() => setConfirmationAction(null)}
            >
              Close
            </button>
          </form>
        </dialog>
      )}
    </SettingsPanel>
  );
}
