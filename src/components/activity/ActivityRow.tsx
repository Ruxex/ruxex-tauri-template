import { useTranslation } from "react-i18next";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
  ExclamationCircleIcon,
  PlayCircleIcon,
} from "@heroicons/react/24/outline";
import { Link } from "react-router-dom";

import type { ActivityEntry } from "./activity-model";

function statusTone(status: string): string {
  if (status === "completed") return "text-success";
  if (status === "failed") return "text-error";
  if (status === "interrupted") return "text-warning";
  if (status === "running") return "text-info";
  return "text-base-content/60";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircleIcon aria-hidden="true" className="size-5" />;
  }
  if (status === "failed" || status === "interrupted") {
    return <ExclamationCircleIcon aria-hidden="true" className="size-5" />;
  }
  if (status === "running") {
    return <PlayCircleIcon aria-hidden="true" className="size-5" />;
  }
  if (status === "pending") {
    return <ClockIcon aria-hidden="true" className="size-5" />;
  }
  return <CpuChipIcon aria-hidden="true" className="size-5" />;
}

export function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { t } = useTranslation("activity");

  const kindLabels: Record<ActivityEntry["kind"], string> = {
    approval: t("approval"),
    agent: t("subagent"),
    thread: t("thread"),
    tool: t("tool"),
  };

  return (
    <li className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className={`mt-0.5 shrink-0 ${statusTone(entry.status)}`}>
            <StatusIcon status={entry.status} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-medium">{entry.title}</h2>
              <span className="badge badge-ghost badge-sm">
                {kindLabels[entry.kind]}
              </span>
              <span
                className={`text-xs capitalize ${statusTone(entry.status)}`}
              >
                {t(`statuses.${entry.status}`, { defaultValue: entry.status })}
              </span>
            </div>
            <p className="mt-1 break-words text-sm text-base-content/65">
              {entry.detail}
            </p>
          </div>
        </div>
        {entry.kind === "approval" ? (
          <Link className="btn btn-ghost btn-sm shrink-0" to="/approvals">
            {t("openApprovals")}
            <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
          </Link>
        ) : entry.threadId ? (
          <Link
            className="btn btn-ghost btn-sm shrink-0"
            to={`/chat/${encodeURIComponent(entry.threadId)}`}
          >
            {t("openThread")}
            <ArrowTopRightOnSquareIcon aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}
