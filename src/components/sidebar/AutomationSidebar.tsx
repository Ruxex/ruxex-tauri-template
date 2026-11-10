import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { NavLink } from "react-router-dom";

import { useSchedules } from "../../app-server/hooks";
import { formatErrorMessage } from "../../app/error-message";
import { formatDateTime } from "../../pages/schedules/schedule-format";
import { SidebarHeader } from "./SidebarHeader";

export function AutomationSidebar({ onClose }: { onClose: () => void }) {
  const schedules = useSchedules();
  const recentRuns = (schedules.query.data ?? [])
    .filter((schedule) => schedule.lastRun)
    .sort((left, right) => {
      const leftAt = left.lastRun?.at ?? "";
      const rightAt = right.lastRun?.at ?? "";
      return rightAt.localeCompare(leftAt);
    });

  return (
    <aside
      aria-label="Automation sidebar"
      className="flex h-full min-h-0 w-72 flex-col overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label="Automation" onClose={onClose} />
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
          Recent runs
        </h3>
        <NavLink className="link link-primary text-xs" to="/schedules">
          View all
        </NavLink>
      </div>
      {schedules.query.isLoading && (
        <div className="flex items-center gap-2 pt-4 text-sm text-base-content/60">
          <span className="loading loading-spinner loading-xs" />
          Loading…
        </div>
      )}
      {schedules.query.isError && (
        <p className="pt-4 text-sm text-error">
          Unable to load recent runs: {formatErrorMessage(schedules.query.error)}
        </p>
      )}
      {!schedules.query.isLoading && !schedules.query.isError && (
        <ul className="mt-2 space-y-1">
          {recentRuns.map((schedule) => {
            const lastRun = schedule.lastRun;
            if (!lastRun) return null;
            const RunIcon = lastRun.success ? CheckCircleIcon : XCircleIcon;

            return (
              <li
                className="rounded-box border border-base-300 bg-base-200/35 px-3 py-2.5"
                data-testid="recent-automation-item"
                key={`${schedule.id}-${lastRun.at}`}
              >
                <div className="flex items-start gap-2">
                  <RunIcon
                    aria-hidden="true"
                    className={`mt-0.5 size-4 shrink-0 ${lastRun.success ? "text-success" : "text-error"}`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {schedule.name}
                    </p>
                    <p
                      className={`text-xs ${lastRun.success ? "text-success" : "text-error"}`}
                    >
                      {lastRun.success ? "Succeeded" : "Failed"}
                    </p>
                    <time
                      className="mt-1 block truncate text-xs text-base-content/55"
                      dateTime={lastRun.at}
                      title={formatDateTime(lastRun.at)}
                    >
                      {formatDateTime(lastRun.at)}
                    </time>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
