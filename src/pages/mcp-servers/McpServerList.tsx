import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";

import type { McpServerEntry } from "../../app-server/mcp-config";
import type { v2 } from "../../protocol";
import { McpOAuthLoginAction } from "../../components/mcp/McpOAuthLoginAction";
import { StateBadge } from "../../components/common/StateBadge";
import { mcpConnectionStatusLabel } from "../../components/mcp/mcp-status-labels";

export function McpServerList({
  entries,
  statuses,
  isWritePending,
  onEdit,
  onEnabledChange,
}: {
  entries: McpServerEntry[];
  statuses: v2.McpServerStatus[];
  isWritePending: boolean;
  onEdit: (entry: McpServerEntry, trigger: HTMLButtonElement) => void;
  onEnabledChange: (entry: McpServerEntry, enabled: boolean) => void;
}) {
  const { t } = useTranslation("mcp");
  const statusByName = useMemo(
    () => new Map(statuses.map((status) => [status.name, status])),
    [statuses],
  );

  return (
    <ul>
      {entries.map((entry) => {
        const status = statusByName.get(entry.name);
        const enabled = entry.draft?.enabled ?? false;
        const needsAuthentication =
          status?.authStatus === "notLoggedIn" ||
          status?.runtimeStatus === "authenticationRequired";
        const canLogIn =
          needsAuthentication && entry.draft?.transport === "streamableHttp";

        return (
          <li
            className="flex flex-col gap-3 border-b border-base-300 py-4 sm:flex-row sm:items-center sm:justify-between"
            key={entry.name}
          >
            <p className="min-w-0 font-medium">{entry.name}</p>

            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {canLogIn ? (
                <McpOAuthLoginAction
                  authStatus={status?.authStatus}
                  name={entry.name}
                  runtimeStatus={status?.runtimeStatus}
                />
              ) : status && needsAuthentication ? (
                <StateBadge tone="warning">{t("unauthenticated")}</StateBadge>
              ) : (
                <span className="text-xs text-base-content/60">
                  {status
                    ? mcpConnectionStatusLabel(status.runtimeStatus)
                    : t("statusUnavailable")}
                </span>
              )}

              {entry.draft && (
                <button
                  aria-label={t("configureNamedServer", {
                    name: entry.name,
                  })}
                  className="btn btn-ghost btn-sm btn-square"
                  type="button"
                  onClick={(event) => onEdit(entry, event.currentTarget)}
                >
                  <Cog6ToothIcon aria-hidden="true" className="size-5" />
                </button>
              )}

              {entry.draft && (
                <label
                  className="flex items-center"
                  title={enabled ? t("disableServer") : t("enableServer")}
                >
                  <span className="sr-only">
                    {enabled ? t("enabled") : t("disabled")}
                  </span>
                  <input
                    aria-label={t("enableNamedServer", {
                      name: entry.name,
                    })}
                    aria-checked={enabled}
                    checked={enabled}
                    className="toggle toggle-primary toggle-sm"
                    disabled={isWritePending}
                    onChange={(event) =>
                      onEnabledChange(entry, event.target.checked)
                    }
                    role="switch"
                    type="checkbox"
                  />
                </label>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
