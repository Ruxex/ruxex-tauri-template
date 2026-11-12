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
      <section className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Run history</h2>
        {(schedule.runs ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-base-content/60">No runs yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {[...(schedule.runs ?? [])].reverse().map((run) => (
              <li
                className="flex items-center justify-between gap-3 rounded-box bg-base-200 p-3"
                key={`${run.at}-${run.threadId}`}
              >
                <div>
                  <p className={run.success ? "text-success" : "text-error"}>
                    {run.success ? "Succeeded" : "Failed"}
                  </p>
                  <time
                    className="text-xs text-base-content/60"
                    dateTime={run.at}
                  >
                    {formatDateTime(run.at)}
                  </time>
                </div>
                {run.threadId && (
                  <Link
                    className="btn btn-ghost btn-sm"
                    to={`/chat/${run.threadId}`}
                  >
                    Open chat
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
