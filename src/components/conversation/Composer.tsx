import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowPathIcon,
  ArrowUturnRightIcon,
  PaperAirplaneIcon,
  QueueListIcon,
  StopIcon,
} from "@heroicons/react/24/outline";

import { buildImageUserInput } from "./composer-model";
import { buildUserTextInput } from "./conversation-model";
import {
  ComposerOptions,
  PermissionMenu,
  SubmissionModeMenu,
  type PermissionMode,
} from "./ComposerOptions";
import { ComposerSettings } from "./ComposerSettings";
import type { SubmissionMode } from "./composer-model";
import { formatErrorMessage } from "../../app/error-message";
import { useImageAttachment } from "../common/useImageAttachment";
import {
  useInterruptTurn,
  useModelList,
  useQueueMessage,
  useSetThreadGoal,
  useSendMessage,
  useSteerTurn,
  useUpdateThreadSettings,
} from "../../app-server/hooks";

type ComposerProps = {
  threadId: string;
  activeTurnId: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
};

export function Composer({
  threadId,
  activeTurnId,
  model: initialModel = null,
  reasoningEffort: initialEffort = null,
}: ComposerProps) {
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<SubmissionMode>("send");
  const [goalMode, setGoalMode] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [model, setModel] = useState(initialModel ?? "");
  const [effort, setEffort] = useState(initialEffort ?? "");
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const {
    attachmentError,
    attachmentInput,
    handleAttachmentChange,
    imageFile,
    readImage,
    resetAttachment,
  } = useImageAttachment();
  const models = useModelList();
  const send = useSendMessage();
  const steer = useSteerTurn();
  const queue = useQueueMessage();
  const interrupt = useInterruptTurn();
  const setGoal = useSetThreadGoal();
  const updateSettings = useUpdateThreadSettings();
  const isPending =
    send.isPending ||
    steer.isPending ||
    queue.isPending ||
    interrupt.isPending ||
    setGoal.isPending ||
    updateSettings.isPending;
  const SubmitIcon = isPending
    ? ArrowPathIcon
    : mode === "queue"
      ? QueueListIcon
      : mode === "steer"
        ? ArrowUturnRightIcon
        : PaperAirplaneIcon;

  useEffect(() => {
    setModel(initialModel ?? "");
  }, [initialModel]);

  useEffect(() => {
    setEffort(initialEffort ?? "");
  }, [initialEffort]);

  function handleModelChange(value: string) {
    setModel(value);
    void updateSettings
      .mutateAsync({ threadId, model: value || null })
      .catch(() => undefined);
  }

  function handleEffortChange(value: string) {
    setEffort(value);
    void updateSettings
      .mutateAsync({ threadId, effort: value || null })
      .catch(() => undefined);
  }

  function handlePermissionChange(value: PermissionMode) {
    setPermissionMode(value);
    const settings = {
      ask: {
        approvalPolicy: "on-request" as const,
        sandboxPolicy: null,
      },
      "read-only": {
        approvalPolicy: "on-request" as const,
        sandboxPolicy: { type: "readOnly" as const, networkAccess: false },
      },
      "full-access": {
        approvalPolicy: "never" as const,
        sandboxPolicy: { type: "dangerFullAccess" as const },
      },
    }[value];
    void updateSettings
      .mutateAsync({ threadId, ...settings })
      .catch(() => undefined);
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.nativeEvent.isComposing ||
      event.key !== "Enter" ||
      !event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if ((!text && !imageFile) || isPending || (goalMode && !text)) {
      return;
    }
    const input = text ? [buildUserTextInput(text)] : [];
    try {
      if (goalMode) {
        await setGoal.mutateAsync({
          threadId,
          objective: text,
          status: "active",
        });
        setMessage("");
        resetAttachment();
        return;
      }
      if (imageFile) {
        input.unshift(buildImageUserInput(await readImage(imageFile)));
      }
      if (mode === "steer") {
        if (!activeTurnId) {
          return;
        }
        await steer.mutateAsync({
          threadId,
          expectedTurnId: activeTurnId,
          input,
        });
      } else if (mode === "queue") {
        await queue.mutateAsync({ threadId, input });
      } else {
        await send.mutateAsync({
          threadId,
          input,
          turnTrigger: planMode ? "plan" : null,
        });
      }
      setMessage("");
      resetAttachment();
    } catch {
      // Mutation state renders the error below the composer.
    }
  }

  return (
    <form
      className="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <textarea
        className="textarea textarea-ghost min-h-24 w-full resize-none"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleMessageKeyDown}
        placeholder="Ask Ruxex to work on something…"
        disabled={isPending}
        aria-label="Message"
      />
      <input
        ref={attachmentInput}
        accept="image/*"
        className="hidden"
        onChange={handleAttachmentChange}
        type="file"
        aria-label="Image attachment"
      />
      {imageFile && (
        <p
          className="mt-2 text-sm text-base-content/70"
          data-testid="selected-image"
        >
          Attached image: {imageFile.name}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ComposerOptions
            disabled={isPending}
            goalMode={goalMode}
            onGoalModeChange={() => setGoalMode((value) => !value)}
            onPlanModeChange={() => setPlanMode((value) => !value)}
            onAttach={() => attachmentInput.current?.click()}
            planMode={planMode}
          />
          <PermissionMenu
            disabled={isPending}
            mode={permissionMode}
            onModeChange={handlePermissionChange}
          />
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <ComposerSettings
            disabled={isPending}
            effort={effort}
            model={model}
            models={models.data?.data ?? []}
            onEffortChange={handleEffortChange}
            onModelChange={handleModelChange}
          />
          {activeTurnId && (
            <button
              className="btn btn-error btn-sm btn-outline"
              type="button"
              onClick={() =>
                void interrupt.mutateAsync({ threadId, turnId: activeTurnId })
              }
              disabled={isPending}
            >
              <StopIcon aria-hidden="true" className="size-4" />
              Stop
            </button>
          )}
          <div className="join">
            <button
              className="btn btn-primary btn-sm join-item"
              type="submit"
              disabled={isPending || (!message.trim() && !imageFile)}
            >
              <SubmitIcon
                aria-hidden="true"
                className={`size-4 ${isPending ? "animate-spin" : ""}`}
              />
              {isPending
                ? "Working…"
                : goalMode
                  ? "Set goal"
                  : mode === "queue"
                    ? "Queue"
                    : mode === "steer"
                      ? "Steer"
                      : "Send"}
            </button>
            <SubmissionModeMenu
              activeTurnId={activeTurnId}
              disabled={isPending}
              mode={mode}
              onModeChange={setMode}
            />
          </div>
        </div>
      </div>
      {(attachmentError ||
        send.error ||
        steer.error ||
        queue.error ||
        interrupt.error ||
        setGoal.error ||
        updateSettings.error) && (
        <p className="mt-2 text-sm text-error">
          {attachmentError ||
            formatErrorMessage(
              send.error ||
                steer.error ||
                queue.error ||
                interrupt.error ||
                setGoal.error ||
                updateSettings.error,
            )}
        </p>
      )}
    </form>
  );
}
