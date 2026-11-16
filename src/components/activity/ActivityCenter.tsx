import { formatNumber } from "../../app/locale-format";
import { useTranslation } from "react-i18next";
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
import { PendingRequestsSection } from "../approvals/PendingRequestsSection";
import { StateBadge } from "../common/StateBadge";
import { ActivityRow } from "./ActivityRow";
import {
  type ActivityFilter,
  buildActivityEntries,
  filterActivityEntries,
} from "./activity-model";

export function ActivityCenter() {
  const { t, i18n } = useTranslation("activity");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";

  const filters: Array<{ id: ActivityFilter; label: string }> = [
    { id: "all", label: t("all") },
    { id: "needsAction", label: t("needsAction") },
    { id: "running", label: t("running") },
    { id: "agents", label: t("agents") },
    { id: "completed", label: t("completed") },
  ];

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
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          {t("workspace")}
        </p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <ChartBarIcon aria-hidden="true" className="size-7 text-primary" />
          {t("activity")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-base-content/65">
          {t("monitorSubagentsRunningThreadsAndActionsWaitingForYourApproval")}
        </p>
      </div>

      {!events.connected && (
        <div className="alert alert-warning">
          <ExclamationTriangleIcon aria-hidden="true" className="size-5" />
          <StateBadge tone="warning">{t("disconnected")}</StateBadge>
        </div>
      )}

      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">{t("activityFilters")}</legend>
        {filters.map((option) => (
          <button
            aria-label={option.label}
            aria-pressed={filter === option.id}
            className={`btn btn-sm ${filter === option.id ? "btn-primary" : "btn-ghost"}`}
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
          >
            {option.label}
            {option.id === "needsAction" && pendingRequests.length > 0 && (
              <span className="badge badge-warning badge-sm">
                {formatNumber(pendingRequests.length, locale)}
              </span>
            )}
          </button>
        ))}
      </fieldset>

      {filter === "needsAction" ? (
        <PendingRequestsSection
          connected={events.connected}
          pendingRequests={pendingRequests}
        />
      ) : entries.length > 0 ? (
        <ul aria-label={t("activityEntries")} className="grid gap-3">
          {entries.map((entry) => (
            <ActivityRow entry={entry} key={entry.id} />
          ))}
        </ul>
      ) : (
        <div className="card border border-dashed border-base-300 bg-base-100">
          <div className="card-body items-center text-center">
            <p>{t("noActivityYet")}</p>
            <p className="text-sm text-base-content/60">
              {t("activityFromThreadsAndSubagentsWillAppearHere")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
