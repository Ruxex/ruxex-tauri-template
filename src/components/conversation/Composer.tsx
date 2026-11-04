import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
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
import { SlashCommandPalette } from "./SlashCommandPalette";
import {
  getSlashCommandInput,
  selectSlashCommand,
  type SlashCommandId,
} from "./slash-command";
import type { SubmissionMode } from "./composer-model";
import { useComposerSelection } from "./useComposerSelection";
import { formatErrorMessage } from "../../app/error-message";
import { AttachmentPreview } from "../common/AttachmentPreview";
import { useImageAttachment } from "../common/useImageAttachment";
import {
  useArchiveThread,
  useCompactThread,
  useInterruptTurn,
  useModelList,
  useQueueMessage,
  useSendMessage,
  useSetThreadGoal,
  useSteerTurn,
  useUpdateThreadSettings,
} from "../../app-server/hooks";
import { useBranding } from "../../app/branding-context";

type ComposerProps = {
  threadId: string;
  activeTurnId: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
  initialMessage?: string;
  onMessageSent?: () => void;
};

export function Composer({
  threadId,
  activeTurnId,
  model: initialModel = null,
  reasoningEffort: initialEffort = null,
  initialMessage,
  onMessageSent,
}: ComposerProps) {
  const branding = useBranding();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<SubmissionMode>("send");
  const [goalMode, setGoalMode] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    attachmentError,
    attachmentInput,
    clearAttachment,
    handleAttachmentChange,
    imageFile,
    readImage,
    resetAttachment,
  } = useImageAttachment();
  const models = useModelList();
  const { effort, model, setEffort, setModel } = useComposerSelection(
    models.data?.data ?? [],
    initialModel,
    initialEffort,
  );
  const send = useSendMessage();
  const archive = useArchiveThread();
  const compact = useCompactThread();
  const steer = useSteerTurn();
  const queue = useQueueMessage();
  const interrupt = useInterruptTurn();
  const setGoal = useSetThreadGoal();
  const updateSettings = useUpdateThreadSettings();
  const isPending =
    send.isPending ||
    archive.isPending ||
    compact.isPending ||
    steer.isPending ||
    queue.isPending ||
    interrupt.isPending ||
    setGoal.isPending ||
    updateSettings.isPending;
  const showSlashCommands = getSlashCommandInput(message) !== null && !goalMode;

  useEffect(() => {
    if (initialMessage !== undefined) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);
  const SubmitIcon = isPending
    ? ArrowPathIcon
    : mode === "queue"
      ? QueueListIcon
      : mode === "steer"
        ? ArrowUturnRightIcon
        : PaperAirplaneIcon;

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

  async function handleSlashCommandSelect(command: SlashCommandId) {
    const selection = selectSlashCommand(message, command);
    if (selection.kind === "goal") {
      setGoalMode(true);
      setMessage(selection.message);
      textareaRef.current?.focus();
      return;
    }

    try {
      if (selection.command === "archive") {
        await archive.mutateAsync({ threadId });
      } else {
        await compact.mutateAsync({ threadId });
      }
      setMessage("");
    } catch {
      // Mutation state renders the error below the composer.
    }
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
          model: model || null,
          effort: effort || null,
          turnTrigger: planMode ? "plan" : null,
        });
      }
      setMessage("");
      resetAttachment();
      onMessageSent?.();
    } catch {
      // Mutation state renders the error below the composer.
    }
  }

  return (
    <form
      className="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
      onSubmit={(event) => void handleSubmit(event)}
    >
      {showSlashCommands && (
        <SlashCommandPalette
          disabled={isPending}
          onSelect={(command) => void handleSlashCommandSelect(command)}
        />
      )}
      <textarea
        ref={textareaRef}
        className="textarea textarea-ghost min-h-24 w-full resize-none"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={handleMessageKeyDown}
        placeholder={`${branding ? `Ask ${branding.assistantName}` : "Ask the assistant"} to work on something…`}
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
        <AttachmentPreview
          disabled={isPending}
          file={imageFile}
          onRemove={clearAttachment}
        />
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
        archive.error ||
        compact.error ||
        steer.error ||
        queue.error ||
        interrupt.error ||
        setGoal.error ||
        updateSettings.error) && (
        <p className="mt-2 text-sm text-error">
          {attachmentError ||
            formatErrorMessage(
              send.error ||
                archive.error ||
                compact.error ||
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
