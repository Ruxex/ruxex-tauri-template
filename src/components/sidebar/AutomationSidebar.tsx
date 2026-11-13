import { Link } from "react-router-dom";

import { useSchedules } from "../../app-server/hooks";
import { formatErrorMessage } from "../../app/error-message";
import {
  formatDateTime,
  formatRelativeDateTime,
} from "../../pages/schedules/schedule-format";
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
      <h3 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
        Recent runs
      </h3>
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
            const threadId = lastRun.threadId ?? schedule.threadId;

            return (
              <li
                data-testid="recent-automation-item"
                key={`${schedule.id}-${lastRun.at}`}
              >
                {threadId ? (
                  <Link
                    aria-label={`Open chat: ${schedule.name}`}
                    className="block rounded-box border border-base-300 bg-base-200/35 px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-base-200"
                    to={`/chat/${threadId}`}
                  >
                    <RecentRunText at={lastRun.at} title={schedule.name} />
                  </Link>
                ) : (
                  <div className="rounded-box border border-base-300 bg-base-200/35 px-3 py-2.5">
                    <RecentRunText at={lastRun.at} title={schedule.name} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function RecentRunText({ title, at }: { title: string; at: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">{title}</p>
      <time
        className="mt-1 block truncate text-xs text-base-content/55"
        dateTime={at}
        title={formatDateTime(at)}
      >
        {formatRelativeDateTime(at)}
      </time>
    </div>
  );
}
