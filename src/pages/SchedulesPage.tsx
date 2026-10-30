import { type FormEvent, useReducer, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { formatErrorMessage } from "../app/error-message";
import { useSchedules } from "../app-server/hooks";
import { isDesktopRuntime } from "../app-server/runtime";
import { PageContainer } from "../components/layout/PageContainer";
import type { ScheduleRecord } from "../platform/schedules";
import {
  ScheduleActionDialog,
  type ScheduleAction,
} from "./schedules/ScheduleActionDialog";
import { EmptyScheduleList, ScheduleCard } from "./schedules/ScheduleCard";
import { ScheduleEditorDialog } from "./schedules/ScheduleEditorDialog";
import {
  createScheduleFormState,
  scheduleFormReducer,
  scheduleInputFromForm,
} from "./schedules/schedule-form";
import { browserTimeZone } from "./schedules/schedule-format";

export function SchedulesPage() {
  const schedules = useSchedules();
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRecord | null>(
    null,
  );
  const [form, dispatch] = useReducer(
    scheduleFormReducer,
    createScheduleFormState(),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ScheduleAction | null>(
    null,
  );
  const isScheduleModalOpen = isCreatePanelOpen || editingSchedule !== null;

  function openCreatePanel() {
    setEditingSchedule(null);
    dispatch({ type: "reset" });
    setFormError(null);
    setIsCreatePanelOpen(true);
  }

  function openEditPanel(schedule: ScheduleRecord) {
    setEditingSchedule(schedule);
    setIsCreatePanelOpen(false);
    dispatch({ type: "reset", schedule });
    setFormError(null);
  }

  function closeEditor() {
    setIsCreatePanelOpen(false);
    setEditingSchedule(null);
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

  const savedSchedules = schedules.query.data ?? [];
  const actionError = schedules.runNow.isError
    ? `Unable to run schedule: ${formatErrorMessage(schedules.runNow.error)}`
    : schedules.remove.isError
      ? `Unable to delete schedule: ${formatErrorMessage(schedules.remove.error)}`
      : schedules.setEnabled.isError
        ? `Unable to update schedule status: ${formatErrorMessage(schedules.setEnabled.error)}`
        : null;
  const editorMutation = editingSchedule ? schedules.update : schedules.create;
  const editorError =
    formError ??
    (editorMutation.isError
      ? `Unable to ${editingSchedule ? "update" : "create"} schedule: ${formatErrorMessage(editorMutation.error)}`
      : null);

  return (
    <PageContainer>
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-base-300 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Automation</h1>
        <button
          aria-expanded={isScheduleModalOpen}
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
          {isScheduleModalOpen ? "Close" : "New schedule"}
        </button>
      </header>

      {!isDesktopRuntime && (
        <p className="alert alert-info text-sm">
          Schedules are available in the Tauri desktop runtime.
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

      <section aria-labelledby="schedule-list-heading">
        <div className="flex items-end justify-between gap-4 border-b border-base-300 pb-3">
          <div>
            <h2 className="text-lg font-semibold" id="schedule-list-heading">
              Your schedules
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              {savedSchedules.length} schedule
              {savedSchedules.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        {actionError && (
          <p className="mt-4 text-sm text-error" role="alert">
            {actionError}
          </p>
        )}
        {schedules.query.isLoading && (
          <div className="flex items-center gap-3 pt-4 text-sm text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            Loading schedules…
          </div>
        )}
        {schedules.query.isError && (
          <p className="pt-4 text-sm text-error">
            Unable to load schedules:{" "}
            {formatErrorMessage(schedules.query.error)}
          </p>
        )}
        {!schedules.query.isLoading && !schedules.query.data?.length && (
          <EmptyScheduleList onCreate={openCreatePanel} />
        )}
        <div className="grid gap-3 pt-4 sm:grid-cols-2">
          {schedules.query.data?.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              isDeletePending={schedules.remove.isPending}
              isRunPending={schedules.runNow.isPending}
              isTogglePending={schedules.setEnabled.isPending}
              schedule={schedule}
              onEdit={openEditPanel}
              onEnabledChange={(target, enabled) =>
                schedules.setEnabled.mutate({ id: target.id, enabled })
              }
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
