import { Link } from "react-router-dom";

import { useSchedules } from "../../app-server/hooks";
import { formatErrorMessage } from "../../app/error-message";
import { ProjectIcon } from "../projects/ProjectIcon";
import { projectColorClassName } from "../projects/project-metadata";
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
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-y-auto bg-base-100 p-4"
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
          Unable to load recent runs:{" "}
          {formatErrorMessage(schedules.query.error)}
        </p>
      )}
      {!schedules.query.isLoading && !schedules.query.isError && (
        <ul className="mt-2 space-y-1">
          {recentRuns.map((schedule) => {
            const lastRun = schedule.lastRun;
            if (!lastRun) return null;
            const threadId = lastRun.threadId ?? schedule.threadId;
            const iconTileClassName = schedule.enabled
              ? projectColorClassName(schedule.color)
              : "bg-base-200 text-base-content/45";
            const content = (
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconTileClassName}`}
                >
                  <ProjectIcon className="size-4" icon={schedule.icon} />
                </span>
                <RecentRunText
                  at={lastRun.at}
                  disabled={!schedule.enabled}
                  title={schedule.name}
                />
              </div>
            );

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
                    {content}
                  </Link>
                ) : (
                  <div className="rounded-box border border-base-300 bg-base-200/35 px-3 py-2.5">
                    {content}
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

function RecentRunText({
  title,
  at,
  disabled,
}: {
  title: string;
  at: string;
  disabled: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={`truncate text-sm font-medium ${disabled ? "text-base-content/60" : ""}`}
      >
        {title}
      </p>
      <time
        className={`mt-1 block truncate text-xs ${disabled ? "text-base-content/40" : "text-base-content/55"}`}
        dateTime={at}
        title={formatDateTime(at)}
      >
        {formatRelativeDateTime(at)}
      </time>
    </div>
  );
}
