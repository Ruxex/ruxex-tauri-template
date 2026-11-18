import { useTranslation } from "react-i18next";
import { PencilIcon, PlayIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type FormEvent, useReducer, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { formatErrorMessage } from "@/app/error-message";
import { useArchiveThread, useSchedules, useThread } from "@/app-server/hooks";
import { ThreadCard } from "@/components/base/common/ThreadCard";
import { PageContainer } from "@/components/feature/layout/PageContainer";
import { ProjectIcon } from "@/components/composite/projects/ProjectIcon";
import { projectColorClassName } from "@/components/composite/projects/project-metadata";
import type { ScheduleRun } from "@/platform/schedules";
import { type ScheduleAction, ScheduleActionDialog } from "@/pages/schedules/ScheduleActionDialog";
import { ScheduleEditorDialog } from "@/pages/schedules/ScheduleEditorDialog";
import {
  createScheduleFormState,
  scheduleFormReducer,
  scheduleInputFromForm,
  type ScheduleFormState,
} from "@/pages/schedules/schedule-form";
import { browserTimeZone, formatDateTime, scheduleCadenceLabel } from "@/pages/schedules/schedule-format";

export function ScheduleDetailPage() {
  const { t, i18n } = useTranslation("schedules");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const schedules = useSchedules();
  const archiveThread = useArchiveThread();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, dispatch] = useReducer(scheduleFormReducer, createScheduleFormState());
  const [invalidForm, setInvalidForm] = useState<ScheduleFormState | null>(null);
  const invalidResult = invalidForm ? scheduleInputFromForm(invalidForm, browserTimeZone()) : null;
  const formError = invalidResult && !invalidResult.ok ? invalidResult.message : null;
  const [pendingAction, setPendingAction] = useState<ScheduleAction | null>(null);
  const schedule = schedules.query.data?.find((item) => item.id === scheduleId);

  if (!schedule) {
    return <p className="alert alert-error">{t("automationNotFound")}</p>;
  }
  const currentSchedule = schedule;

  function openEditor() {
    dispatch({ type: "reset", schedule: currentSchedule });
    setInvalidForm(null);
    setIsEditorOpen(true);
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setInvalidForm(null);
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvalidForm(null);
    const result = scheduleInputFromForm(form, browserTimeZone());
    if (!result.ok) {
      setInvalidForm(form);
      return;
    }
    schedules.update.mutate({ id: currentSchedule.id, input: result.input }, { onSuccess: closeEditor });
  }

  function confirmAction() {
    if (!pendingAction) return;
    if (pendingAction.kind === "run") {
      schedules.runNow.mutate(currentSchedule.id, {
        onSuccess: () => setPendingAction(null),
      });
      return;
    }
    schedules.remove.mutate(currentSchedule.id, {
      onSuccess: () => {
        setPendingAction(null);
        navigate("/schedules");
      },
    });
  }

  const editorError =
    formError ??
    (schedules.update.isError
      ? t("updateError", {
          details: formatErrorMessage(schedules.update.error),
        })
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
          <span
            className={`mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl ${currentSchedule.enabled ? projectColorClassName(currentSchedule.color) : "bg-base-200 text-base-content/45"}`}
          >
            <ProjectIcon aria-hidden="true" className="size-6" icon={currentSchedule.icon} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">{t("automation")}</p>
            <h1 className="text-3xl font-semibold">{currentSchedule.name}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input
            aria-label={t(currentSchedule.enabled ? "disableNamed" : "enableNamed", { name: currentSchedule.name })}
            checked={currentSchedule.enabled}
            className="toggle toggle-primary toggle-sm"
            disabled={schedules.setEnabled.isPending}
            onChange={(event) =>
              schedules.setEnabled.mutate({
                id: currentSchedule.id,
                enabled: event.target.checked,
              })
            }
            type="checkbox"
          />
          <button
            aria-label={t("editNamed", { name: currentSchedule.name })}
            className="btn btn-ghost btn-sm btn-square"
            disabled={schedules.update.isPending}
            title={t("edit")}
            type="button"
            onClick={openEditor}
          >
            <PencilIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={t("runNamed", { name: currentSchedule.name })}
            className="btn btn-ghost btn-sm btn-square"
            disabled={schedules.runNow.isPending}
            title={t("runNow")}
            type="button"
            onClick={() => setPendingAction({ kind: "run", schedule: currentSchedule })}
          >
            <PlayIcon aria-hidden="true" className="size-4" />
          </button>
          <button
            aria-label={t("deleteNamed", { name: currentSchedule.name })}
            className="btn btn-ghost btn-sm btn-square"
            disabled={schedules.remove.isPending}
            title={t("delete")}
            type="button"
            onClick={() => setPendingAction({ kind: "delete", schedule: currentSchedule })}
          >
            <TrashIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>
      {schedules.setEnabled.isError && (
        <p className="text-sm text-error" role="alert">
          {t("unableToUpdateScheduleStatus", {
            details: formatErrorMessage(schedules.setEnabled.error),
          })}
        </p>
      )}
      <section className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="text-sm font-medium text-base-content/60">{t("schedule")}</h2>
            <p className="mt-1 font-semibold">{scheduleCadenceLabel(currentSchedule.cadence)}</p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-base-content/60">{t("nextRun")}</h2>
            <time className="mt-1 block font-semibold" dateTime={currentSchedule.nextRunAt}>
              {formatDateTime(currentSchedule.nextRunAt, locale)}
            </time>
          </div>
        </div>
        <div className="mt-5 border-t border-base-300 pt-5">
          <h2 className="mb-3 text-lg font-semibold">{t("instructions")}</h2>
          <div className="max-h-24 overflow-y-auto rounded-lg border border-base-300 bg-base-200/50 text-sm leading-6 text-base-content/70">
            <p className="whitespace-pre-wrap break-words p-3">{currentSchedule.prompt}</p>
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
        <h2 className="mb-4 text-lg font-semibold">{t("runHistory")}</h2>
        {(currentSchedule.runs ?? []).length === 0 ? (
          <p className="text-sm text-base-content/60">{t("noRunsYet")}</p>
        ) : (
          <ul className="grid gap-3">
            {[...(currentSchedule.runs ?? [])].reverse().map((run) => (
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
  const { t, i18n } = useTranslation("schedules");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";
  const threadQuery = useThread(run.threadId ?? "");
  const threadId = run.threadId;

  if (!threadId) {
    return (
      <li className="rounded-box border border-base-300 bg-base-100 p-3 text-sm text-base-content/70">
        <time dateTime={run.at}>{formatDateTime(run.at, locale)}</time>
        <p className="mt-1">{run.message}</p>
      </li>
    );
  }

  const thread = threadQuery.data?.thread ?? {
    id: threadId,
    name: null,
    preview: run.message || t("automationRun"),
    updatedAt: Math.floor(new Date(run.at).getTime() / 1000),
  };
  return (
    <li>
      <ThreadCard
        compact
        isArchiving={isArchiving}
        onArchive={() => void archiveThread({ threadId })}
        actions={
          <time className="shrink-0 text-xs text-base-content/60" dateTime={run.at}>
            {formatDateTime(run.at, locale)}
          </time>
        }
        thread={thread}
      />
    </li>
  );
}
