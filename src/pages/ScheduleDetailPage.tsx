import { Link, useParams } from "react-router-dom";

import { useSchedules } from "../app-server/hooks";
import { formatDateTime } from "./schedules/schedule-format";

export function ScheduleDetailPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const schedules = useSchedules();
  const schedule = schedules.query.data?.find((item) => item.id === scheduleId);

  if (!schedule) {
    return <p className="alert alert-error">Automation not found.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Link className="link link-primary text-sm" to="/schedules">
          ← Automations
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">{schedule.name}</h1>
        <p className="mt-2 text-sm text-base-content/70">{schedule.prompt}</p>
      </div>
      <details className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <summary className="cursor-pointer px-5 py-4 text-lg font-semibold">
          Run history
        </summary>
        {(schedule.runs ?? []).length === 0 ? (
          <p className="px-5 pb-5 text-sm text-base-content/60">No runs yet.</p>
        ) : (
          <ul className="space-y-2 px-5 pb-5">
            {[...(schedule.runs ?? [])].reverse().map((run) => (
              <li
                className="rounded-box bg-base-200 p-3"
                key={`${run.at}-${run.threadId}`}
              >
                <time
                  className="text-sm text-base-content/70"
                  dateTime={run.at}
                >
                  {formatDateTime(run.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
