import {
  CalendarDaysIcon,
  PencilIcon,
  PlayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { type FormEvent, useReducer, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { useArchiveThread, useSchedules, useThread } from "../app-server/hooks";
import { ThreadCard } from "../components/common/ThreadCard";
import { PageContainer } from "../components/layout/PageContainer";
import type { ScheduleRun } from "../platform/schedules";
import {
  type ScheduleAction,
  ScheduleActionDialog,
} from "./schedules/ScheduleActionDialog";
import { ScheduleEditorDialog } from "./schedules/ScheduleEditorDialog";
import {
  createScheduleFormState,
  scheduleFormReducer,
  scheduleInputFromForm,
} from "./schedules/schedule-form";
import {
  browserTimeZone,
  formatDateTime,
  scheduleCadenceLabel,
} from "./schedules/schedule-format";

export function ScheduleDetailPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const schedules = useSchedules();
  const archiveThread = useArchiveThread();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, dispatch] = useReducer(
    scheduleFormReducer,
    createScheduleFormState(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ScheduleAction | null>(
    null,
  );
  const schedule = schedules.query.data?.find((item) => item.id === scheduleId);

  if (!schedule) {
    return <p className="alert alert-error">Automation not found.</p>;
  }

  function openEditor() {
    dispatch({ type: "reset", schedule });
    setFormError(null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setFormError(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const result = scheduleInputFromForm(form, browserTimeZone());
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    schedules.update.mutate(
      { id: schedule.id, input: result.input },
      { onSuccess: closeEditor },
    );
  }

  function confirmAction() {
    if (!pendingAction) return;
    if (pendingAction.kind === "run") {
      schedules.runNow.mutate(schedule.id, {
        onSuccess: () => setPendingAction(null),
      });
      return;
    }
    schedules.remove.mutate(schedule.id, {
      onSuccess: () => {
        setPendingAction(null);
        navigate("/schedules");
      },
    });
  }

  const editorError =
    formError ??
    (schedules.update.isError
      ? `Unable to update schedule: ${formatErrorMessage(schedules.update.error)}`
      : null);
  const actionError =
    pendingAction?.kind === "run"
      ? schedules.runNow.error
      : pendingAction?.kind === "delete"
        ? schedules.remove.error
        : null;
  const actionIsPending =
    pendingAction?.kind === "run"
      ? schedules.runNow.isPending
      : pendingAction?.kind === "delete"
        ? schedules.remove.isPending
        : false;

  return (
    <PageContainer className="max-w-3xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDaysIcon aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              Automation
            </p>
            <h1 className="text-3xl font-semibold">{schedule.name}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label={`Edit schedule: ${schedule.name}`}
            className="btn btn-ghost btn-sm btn-square"
            disabled={schedules.update.isPending}
            title="Edit"
            type="button"
            onClick={openEditor}
          >
            <PencilIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={`Run now: ${schedule.name}`}
            className="btn btn-ghost btn-sm btn-square"
            disabled={schedules.runNow.isPending}
            title="Run now"
            type="button"
            onClick={() => setPendingAction({ kind: "run", schedule })}
          >
            <PlayIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={`Delete: ${schedule.name}`}
            className="btn btn-ghost btn-sm btn-square"
            disabled={schedules.remove.isPending}
            title="Delete"
            type="button"
            onClick={() => setPendingAction({ kind: "delete", schedule })}
          >
            <TrashIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>
      <section className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium text-base-content/60">
              Schedule
            </h2>
            <p className="mt-1 font-semibold">
              {scheduleCadenceLabel(schedule.cadence)}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-base-content/60">
              Next run
            </h2>
            <time
              className="mt-1 block font-semibold"
              dateTime={schedule.nextRunAt}
            >
              {formatDateTime(schedule.nextRunAt)}
            </time>
          </div>
        </div>
        <div className="mt-5 border-t border-base-300 pt-5">
          <h2 className="mb-3 text-lg font-semibold">Instructions</h2>
          <div className="max-h-24 overflow-y-auto rounded-lg border border-base-300 bg-base-200/50 text-sm leading-6 text-base-content/70">
            <p className="whitespace-pre-wrap break-words p-3">
              {schedule.prompt}
            </p>
          </div>
        </div>
      </section>
      {isEditorOpen && (
        <ScheduleEditorDialog
          dispatch={dispatch}
          error={editorError}
          form={form}
          isEditing
          isPending={schedules.update.isPending}
          onClose={closeEditor}
          onSubmit={save}
        />
      )}
      {pendingAction && (
        <ScheduleActionDialog
          action={pendingAction}
          error={actionError}
          isPending={actionIsPending}
          onClose={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}
      <section className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Run history</h2>
        {(schedule.runs ?? []).length === 0 ? (
          <p className="text-sm text-base-content/60">No runs yet.</p>
        ) : (
          <ul className="grid gap-3">
            {[...(schedule.runs ?? [])].reverse().map((run) => (
              <ScheduleHistoryItem
                archiveThread={archiveThread.mutateAsync}
                isArchiving={archiveThread.isPending}
                key={`${run.at}-${run.threadId}`}
                run={run}
              />
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}

function ScheduleHistoryItem({
  run,
  archiveThread,
  isArchiving,
}: {
  run: ScheduleRun;
  archiveThread: (params: { threadId: string }) => Promise<unknown>;
  isArchiving: boolean;
}) {
  const threadQuery = useThread(run.threadId ?? "");

  if (!run.threadId) {
    return (
      <li className="rounded-box border border-base-300 bg-base-100 p-3 text-sm text-base-content/70">
        <time dateTime={run.at}>{formatDateTime(run.at)}</time>
        <p className="mt-1">{run.message}</p>
      </li>
    );
  }

  const thread =
    threadQuery.data?.thread ?? {
      id: run.threadId,
      name: null,
      preview: run.message || "Automation run",
      updatedAt: Math.floor(new Date(run.at).getTime() / 1000),
    };
  return (
    <li>
      <ThreadCard
        compact
        isArchiving={isArchiving}
        onArchive={() => void archiveThread({ threadId: run.threadId })}
        actions={
          <time
            className="shrink-0 text-xs text-base-content/60"
            dateTime={run.at}
          >
            {formatDateTime(run.at)}
          </time>
        }
        thread={thread}
      />
    </li>
  );
}
