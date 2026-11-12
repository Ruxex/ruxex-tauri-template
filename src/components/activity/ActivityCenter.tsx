import {
  ChartBarIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

import {
  useAppServerEvents,
  useServerRequests,
  useThreadList,
} from "../../app-server/hooks";
import { StateBadge } from "../common/StateBadge";
import { PendingRequestsSection } from "../approvals/PendingRequestsSection";
import { ActivityRow } from "./ActivityRow";
import {
  buildActivityEntries,
  filterActivityEntries,
  type ActivityFilter,
} from "./activity-model";

const filters: Array<{ id: ActivityFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "needsAction", label: "Needs action" },
  { id: "running", label: "Running" },
  { id: "agents", label: "Agents" },
  { id: "completed", label: "Completed" },
];

export function ActivityCenter() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const events = useAppServerEvents();
  const pendingRequests = useServerRequests();
  const threads = useThreadList({
    archived: false,
    limit: 100,
    sortKey: "updated_at",
    sortDirection: "desc",
  });
  const entries = filterActivityEntries(
    buildActivityEntries(events, threads.data?.data ?? []),
    filter,
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Workspace
        </p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <ChartBarIcon aria-hidden="true" className="size-7 text-primary" />
          Activity
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-base-content/65">
          Monitor subagents, running threads, and actions waiting for your
          approval.
        </p>
      </div>

      {!events.connected && (
        <div className="alert alert-warning">
          <ExclamationTriangleIcon aria-hidden="true" className="size-5" />
          <StateBadge tone="warning">Disconnected</StateBadge>
        </div>
      )}

      <div
        aria-label="Activity filters"
        className="flex flex-wrap gap-2"
        role="group"
      >
        {filters.map((option) => (
          <button
            aria-pressed={filter === option.id}
            className={`btn btn-sm ${filter === option.id ? "btn-primary" : "btn-ghost"}`}
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
          >
            {option.label}
            {option.id === "needsAction" && pendingRequests.length > 0 && (
              <span className="badge badge-warning badge-sm">
                {pendingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filter === "needsAction" ? (
        <PendingRequestsSection
          connected={events.connected}
          pendingRequests={pendingRequests}
        />
      ) : entries.length > 0 ? (
        <ul aria-label="Activity entries" className="grid gap-3">
          {entries.map((entry) => (
            <ActivityRow entry={entry} key={entry.id} />
          ))}
        </ul>
      ) : (
        <div className="card border border-dashed border-base-300 bg-base-100">
          <div className="card-body items-center text-center">
            <p>No activity yet.</p>
            <p className="text-sm text-base-content/60">
              Activity from threads and subagents will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
