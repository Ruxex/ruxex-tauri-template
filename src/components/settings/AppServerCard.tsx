import { useTranslation } from "react-i18next";
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
import { useNativeModalDialog } from "../common/useNativeModalDialog";
import { useCloseDropdownOnOutsidePointerDown } from "../conversation/useCloseDropdown";
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
  const { t } = useTranslation("settings");
  const [stopAction, setStopAction] = useState<"stop" | "forceStop">("stop");
  const [confirmationAction, setConfirmationAction] = useState<
    "restart" | "stop" | "forceStop" | null
  >(null);
  const confirmationDialogRef = useNativeModalDialog(
    confirmationAction !== null,
  );
  const stopOptionsRef = useCloseDropdownOnOutsidePointerDown();
  const inProcess = mode === "inprocess";
  const error =
    connectionError ??
    appServerError ??
    controlError ??
    updateError ??
    daemonError;
  const showDaemonControls = !inProcess && isAvailable;
  const modeLabel = inProcess
    ? t("settings:inProcessMode")
    : appServerReady && appServerError == null
      ? t("settings:daemonMode")
      : t("settings:unavailable");
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
          aria-label={t("settings:refresh")}
          className="btn btn-ghost btn-sm btn-square"
          disabled={isFetching || isRefreshing || isPending || isUpdatePending}
          title={t("settings:refreshAppServerStatus")}
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
      title={t("settings:appServer")}
    >
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label={t("settings:mode")}>
          <StateBadge
            icon={modeTone === "error" ? XCircleIcon : InformationCircleIcon}
            tone={modeTone}
          >
            {modeLabel}
          </StateBadge>
        </SettingRow>
        <SettingRow label={t("settings:connection")}>
          <StateBadge
            icon={connected ? CheckCircleIcon : XCircleIcon}
            tone={connected ? "success" : "error"}
          >
            {connected ? t("settings:connected") : t("settings:disconnected")}
          </StateBadge>
        </SettingRow>
        <SettingRow label={t("settings:liveState")}>
          <StateBadge
            icon={resynchronizing ? ExclamationTriangleIcon : CheckCircleIcon}
            tone={resynchronizing ? "warning" : "success"}
          >
            {resynchronizing
              ? t("settings:resynchronizing")
              : t("settings:synchronized")}
          </StateBadge>
        </SettingRow>
        <SettingRow label={t("settings:appServerVersion")}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span>{displayedVersion ?? t("settings:unavailable")}</span>
            {needsUpdate && (
              <button
                aria-label={
                  isUpdatePending
                    ? t("settings:updating")
                    : t("settings:update")
                }
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
                {isUpdatePending
                  ? t("settings:updating")
                  : t("settings:update")}
              </button>
            )}
          </div>
        </SettingRow>
        {inProcess ? (
          <SettingRow label={t("settings:status")}>
            <StateBadge icon={CheckCircleIcon} tone="success">
              {t("settings:runningInThisProcess")}
            </StateBadge>
          </SettingRow>
        ) : (
          <>
            <SettingRow label={t("settings:status")}>
              <StateBadge
                icon={
                  appServerStatusTone(daemonStatus) === "success"
                    ? CheckCircleIcon
                    : ExclamationTriangleIcon
                }
                tone={appServerStatusTone(daemonStatus)}
              >
                {t(`settings:daemonStatuses.${daemonStatus}`, {
                  defaultValue: daemonStatusLabel,
                })}
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
            aria-label={t("settings:reconnect")}
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
            {t("settings:reconnect")}
          </button>
        )}
        {showDaemonControls && daemonRunning && (
          <>
            <button
              aria-label={t("settings:restart")}
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
              {t("settings:restart")}
            </button>
            <div className="join">
              <button
                aria-label={
                  stopAction === "stop"
                    ? t("settings:stop")
                    : t("settings:forceStop")
                }
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
                {stopAction === "stop"
                  ? t("settings:stop")
                  : t("settings:forceStop")}
              </button>
              <details className="dropdown dropdown-end" ref={stopOptionsRef}>
                <summary
                  aria-disabled={actionDisabled}
                  aria-label={t("settings:stopOptions")}
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
                      {t("settings:stop")}
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
                      {t("settings:forceStop")}
                    </button>
                  </li>
                </ul>
              </details>
            </div>
          </>
        )}
        {showDaemonControls && !daemonRunning && (
          <button
            aria-label={t("settings:start")}
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
            {t("settings:start")}
          </button>
        )}
      </div>
      {confirmationAction !== null && (
        <dialog
          aria-labelledby="app-server-action-title"
          className="modal"
          ref={confirmationDialogRef}
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
                  ? t("settings:restartAppServer")
                  : confirmationAction === "forceStop"
                    ? t("settings:forceStopAppServer")
                    : t("settings:stopAppServer")
              }
            />
            <p className="-mt-2 text-sm text-base-content/70">
              {confirmationAction === "restart"
                ? t("settings:restartWarning")
                : confirmationAction === "forceStop"
                  ? t("settings:forceStopWarning")
                  : t("settings:stopWarning")}
            </p>
            <DialogFooter>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setConfirmationAction(null)}
              >
                {t("settings:cancel")}
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
                  ? t("settings:restart")
                  : confirmationAction === "forceStop"
                    ? t("settings:forceStop")
                    : t("settings:stop")}
              </button>
            </DialogFooter>
          </div>
          <form className="modal-backdrop" method="dialog">
            <button
              aria-label={t("settings:closeConfirmation")}
              type="button"
              onClick={() => setConfirmationAction(null)}
            >
              {t("settings:close")}
            </button>
          </form>
        </dialog>
      )}
    </SettingsPanel>
  );
}
