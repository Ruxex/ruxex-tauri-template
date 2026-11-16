import { useTranslation } from "react-i18next";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type FormEvent, useReducer, useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import { useSchedules } from "../app-server/hooks";
import { isDesktopRuntime } from "../app-server/runtime";
import { PageContainer } from "../components/layout/PageContainer";
import type { ScheduleRecord } from "../platform/schedules";
import {
  type ScheduleAction,
  ScheduleActionDialog,
} from "./schedules/ScheduleActionDialog";
import { EmptyScheduleList, ScheduleCard } from "./schedules/ScheduleCard";
import { ScheduleEditorDialog } from "./schedules/ScheduleEditorDialog";
import {
  createScheduleFormState,
  scheduleFormReducer,
  scheduleInputFromForm,
  type ScheduleFormState,
} from "./schedules/schedule-form";
import { browserTimeZone } from "./schedules/schedule-format";

export function SchedulesPage() {
  const { t } = useTranslation("schedules");
  const schedules = useSchedules();
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(
    null,
  );
  const [form, dispatch] = useReducer(
    scheduleFormReducer,
    createScheduleFormState(),
  );
  const [invalidForm, setInvalidForm] = useState<ScheduleFormState | null>(
    null,
  );
  const invalidResult = invalidForm
    ? scheduleInputFromForm(invalidForm, browserTimeZone())
    : null;
  const formError =
    invalidResult && !invalidResult.ok ? invalidResult.message : null;
  const [pendingAction, setPendingAction] = useState<ScheduleAction | null>(
    null,
  );
  const [pendingScheduleIds, setPendingScheduleIds] = useState<Set<string>>(
    () => new Set(),
  );
  const isScheduleModalOpen = isCreatePanelOpen || editingSchedule !== null;

  function openCreatePanel() {
    setEditingSchedule(null);
    dispatch({ type: "reset" });
    setInvalidForm(null);
    setIsCreatePanelOpen(true);
  }

  function openEditPanel(schedule: ScheduleRecord) {
    setEditingSchedule(schedule);
    setIsCreatePanelOpen(false);
    dispatch({ type: "reset", schedule });
    setInvalidForm(null);
  }

  function closeEditor() {
    setIsCreatePanelOpen(false);
    setEditingSchedule(null);
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
    if (editingSchedule) {
      schedules.update.mutate(
        { id: editingSchedule.id, input: result.input },
        { onSuccess: closeEditor },
      );
    } else {
      schedules.create.mutate(result.input, { onSuccess: closeEditor });
    }
  }

  function confirmAction() {
    if (!pendingAction) return;
    const onSuccess = () => setPendingAction(null);
    if (pendingAction.kind === "run") {
      schedules.runNow.mutate(pendingAction.schedule.id, { onSuccess });
    } else {
      schedules.remove.mutate(pendingAction.schedule.id, { onSuccess });
    }
  }

  function changeScheduleEnabled(target: ScheduleRecord, enabled: boolean) {
    setPendingScheduleIds((current) => new Set(current).add(target.id));
    const finish = () => {
      setPendingScheduleIds((current) => {
        const next = new Set(current);
        next.delete(target.id);
        return next;
      });
    };
    void schedules.setEnabled
      .mutateAsync({ id: target.id, enabled })
      .then(finish, finish);
  }

  const savedSchedules = schedules.query.data ?? [];
  const actionError = schedules.runNow.isError
    ? t("runError", { details: formatErrorMessage(schedules.runNow.error) })
    : schedules.remove.isError
      ? t("deleteError", {
          details: formatErrorMessage(schedules.remove.error),
        })
      : schedules.setEnabled.isError
        ? t("statusError", {
            details: formatErrorMessage(schedules.setEnabled.error),
          })
        : null;
  const editorMutation = editingSchedule ? schedules.update : schedules.create;
  const editorError =
    formError ??
    (editorMutation.isError
      ? t(editingSchedule ? "updateError" : "createError", {
          details: formatErrorMessage(editorMutation.error),
        })
      : null);

  return (
    <PageContainer>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("automation")}
        </h1>
        <button
          aria-expanded={isScheduleModalOpen}
          aria-label={isScheduleModalOpen ? t("close") : t("newSchedule")}
          className="btn btn-primary min-h-11 gap-2"
          type="button"
          onClick={() =>
            isScheduleModalOpen ? closeEditor() : openCreatePanel()
          }
        >
          {isScheduleModalOpen ? (
            <XMarkIcon aria-hidden="true" className="size-4" />
          ) : (
            <PlusIcon aria-hidden="true" className="size-4" />
          )}
          {isScheduleModalOpen ? t("close") : t("newSchedule")}
        </button>
      </header>

      {!isDesktopRuntime && (
        <p className="alert alert-info text-sm">
          {t("schedulesAreAvailableInTheTauriDesktopRuntime")}
        </p>
      )}

      {isScheduleModalOpen && (
        <ScheduleEditorDialog
          dispatch={dispatch}
          error={editorError}
          form={form}
          isEditing={editingSchedule !== null}
          isPending={editorMutation.isPending}
          onClose={closeEditor}
          onSubmit={save}
        />
      )}

      {pendingAction && (
        <ScheduleActionDialog
          action={pendingAction}
          error={
            pendingAction.kind === "run"
              ? schedules.runNow.error
              : schedules.remove.error
          }
          isPending={
            pendingAction.kind === "run"
              ? schedules.runNow.isPending
              : schedules.remove.isPending
          }
          onClose={() => setPendingAction(null)}
          onConfirm={confirmAction}
        />
      )}

      <section className="flex flex-col gap-4">
        {actionError && (
          <p className="text-sm text-error" role="alert">
            {actionError}
          </p>
        )}
        {schedules.query.isLoading && (
          <div className="flex items-center gap-3 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            {t("loadingSchedules")}
          </div>
        )}
        {schedules.query.isError && (
          <p className="text-sm text-error">
            {t("unableToLoadSchedules", {
              details: formatErrorMessage(schedules.query.error),
            })}
          </p>
        )}
        {!schedules.query.isLoading && !schedules.query.data?.length && (
          <EmptyScheduleList onCreate={openCreatePanel} />
        )}
        <div
          className={`grid gap-3 ${savedSchedules.length > 1 ? "sm:grid-cols-2" : "max-w-2xl"}`}
          data-testid="schedule-grid"
        >
          {schedules.query.data?.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              isDeletePending={schedules.remove.isPending}
              isRunPending={schedules.runNow.isPending}
              isTogglePending={pendingScheduleIds.has(schedule.id)}
              schedule={schedule}
              onEdit={openEditPanel}
              onOpen={(target) =>
                (window.location.hash = `/schedules/${target.id}`)
              }
              onEnabledChange={changeScheduleEnabled}
              onRequestAction={(kind, target) =>
                setPendingAction({ kind, schedule: target })
              }
            />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
