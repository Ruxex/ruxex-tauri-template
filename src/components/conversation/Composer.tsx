import {
  ArrowPathIcon,
  ArrowUturnRightIcon,
  PaperAirplaneIcon,
  QueueListIcon,
  StopIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useBranding } from "../../app/branding-context";
import { formatErrorMessage } from "../../app/error-message";
import {
  useArchiveThread,
  useCollaborationModes,
  useCompactThread,
  useInterruptTurn,
  useModelList,
  useQueueMessage,
  useSendMessage,
  useSetThreadGoal,
  useSteerTurn,
  useUpdateThreadSettings,
} from "../../app-server/hooks";
import type { v2 } from "../../protocol";
import { useImageAttachment } from "../common/useImageAttachment";
import {
  ComposerOptions,
  PermissionMenu,
  type PermissionMode,
  SubmissionModeMenu,
} from "./ComposerOptions";
import { ComposerSettings } from "./ComposerSettings";
import { ComposerTextInput } from "./ComposerTextInput";
import { planCollaborationMode } from "./collaboration-model";
import type { SubmissionMode } from "./composer-model";
import {
  buildImageUserInput,
  isComposerSubmitShortcut,
} from "./composer-model";
import { buildUserTextInput } from "./conversation-model";
import { SlashCommandPalette } from "./SlashCommandPalette";
import {
  getSlashCommandInput,
  type SlashCommandId,
  selectSlashCommand,
  selectSlashSkill,
} from "./slash-command";
import { useComposerSelection } from "./useComposerSelection";
import { SelectedComposerSkill } from "./SelectedComposerSkill";
import { useComposerSkills } from "./useComposerSkills";

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
  const [selectedSkill, setSelectedSkill] = useState<Pick<
    v2.SkillMetadata,
    "name" | "path" | "interface"
  > | null>(null);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const editorRef = useRef<HTMLElement>(null);
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
  const { skills, visibleSkills } = useComposerSkills();
  const collaborationModes = useCollaborationModes();
  const { effort, model, setEffort, setModel } = useComposerSelection(
    models.data?.data ?? [],
    initialModel,
    initialEffort,
  );
  const planModeRequest = planCollaborationMode(
    collaborationModes.data?.data ?? [],
    model,
    effort,
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
  const slashCommandInput = getSlashCommandInput(message);
  const showSlashCommands = slashCommandInput !== null && !goalMode;

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

  function handlePlanModeChange() {
    setPlanMode((value) => !value);
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isComposerSubmitShortcut(event)) {
      return;
    }
    event.preventDefault();
    event.currentTarget.closest("form")?.requestSubmit();
  }

  async function handleSlashCommandSelect(command: SlashCommandId) {
    const selection = selectSlashCommand(message, command);
    if (selection.kind === "goal") {
      setGoalMode(true);
      setMessage(selection.message);
      editorRef.current?.focus();
      return;
    }

    try {
      if (selection.command === "archive") {
        await archive.mutateAsync({ threadId });
      } else {
        await compact.mutateAsync({ threadId });
      }
      setMessage("");
      editorRef.current?.focus();
    } catch {
      // Mutation state renders the error below the composer.
    }
  }

  function handleSlashSkillSelect(skill: v2.SkillMetadata) {
    const selection = selectSlashSkill(message, skill);
    setSelectedSkill({
      name: selection.skill.name,
      path: selection.skill.path,
      interface: skill.interface,
    });
    setMessage(selection.message);
    editorRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if ((!text && !imageFile) || isPending || (goalMode && !text)) {
      return;
    }
    const input: v2.UserInput[] = selectedSkill
      ? [
          {
            type: "skill",
            name: selectedSkill.name,
            path: selectedSkill.path,
          },
        ]
      : [];
    if (text) {
      input.push(buildUserTextInput(text));
    }
    try {
      if (goalMode) {
        await setGoal.mutateAsync({
          threadId,
          objective: text,
          status: "active",
        });
        setMessage("");
        setGoalMode(false);
        editorRef.current?.focus();
        resetAttachment();
        return;
      }
      if (imageFile) {
        const imageInput = buildImageUserInput(await readImage(imageFile));
        input.splice(selectedSkill ? 1 : 0, 0, imageInput);
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
          ...(planMode ? { collaborationMode: planModeRequest } : {}),
        });
      }
      setMessage("");
      setSelectedSkill(null);
      resetAttachment();
      onMessageSent?.();
    } catch {
      // Mutation state renders the error below the composer.
    }
  }

  return (
    <div>
      {showSlashCommands && (
        <SlashCommandPalette
          disabled={isPending}
          onDismiss={() => editorRef.current?.focus()}
          onSelectSkill={handleSlashSkillSelect}
          onSelect={(command) => void handleSlashCommandSelect(command)}
          query={slashCommandInput?.query}
          skills={visibleSkills}
          skillsError={skills.isError ? formatErrorMessage(skills.error) : null}
          skillsLoading={skills.isLoading}
        />
      )}
      <form
        className="rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <ComposerTextInput
          attachmentInput={attachmentInput}
          disabled={isPending}
          handleAttachmentChange={handleAttachmentChange}
          imageFile={imageFile}
          onChange={setMessage}
          onEditorReady={(element) => {
            editorRef.current = element;
          }}
          onKeyDown={handleMessageKeyDown}
          onRemoveImage={clearAttachment}
          placeholder={`${branding ? `Ask ${branding.assistantName}` : "Ask the assistant"} to work on something…`}
          value={message}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ComposerOptions
              disabled={isPending}
              goalMode={goalMode}
              onGoalModeChange={() => {
                setGoalMode((value) => !value);
                setSelectedSkill(null);
              }}
              onPlanModeChange={handlePlanModeChange}
              planModeDisabled={!planModeRequest}
              onAttach={() => attachmentInput.current?.click()}
              planMode={planMode}
            />
            {selectedSkill && (
              <SelectedComposerSkill
                onRemove={() => setSelectedSkill(null)}
                skill={selectedSkill}
              />
            )}
            <PermissionMenu
              disabled={isPending}
              mode={permissionMode}
              onModeChange={handlePermissionChange}
            />
            {planMode && (
              <span
                aria-label="Plan mode active"
                className="badge badge-secondary badge-sm gap-1"
                role="status"
              >
                <button
                  aria-label="Disable plan mode"
                  className="btn btn-ghost btn-circle btn-xs size-4 min-h-4 p-0 text-secondary-content hover:bg-secondary-content/10"
                  onClick={handlePlanModeChange}
                  type="button"
                >
                  <XMarkIcon aria-hidden="true" className="size-3" />
                </button>
                Plan
              </span>
            )}
            {goalMode && (
              <span
                aria-label="Goal mode active"
                className="badge badge-primary badge-sm gap-1"
                role="status"
              >
                <button
                  aria-label="Disable goal mode"
                  className="btn btn-ghost btn-circle btn-xs size-4 min-h-4 p-0 text-primary-content hover:bg-primary-content/10"
                  onClick={() => setGoalMode(false)}
                  type="button"
                >
                  <XMarkIcon aria-hidden="true" className="size-3" />
                </button>
                Goal
              </span>
            )}
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
                aria-label="Stop"
                className="btn btn-error btn-sm btn-outline btn-square"
                title="Stop"
                type="button"
                onClick={() =>
                  void interrupt.mutateAsync({ threadId, turnId: activeTurnId })
                }
                disabled={isPending}
              >
                <StopIcon aria-hidden="true" className="size-4" />
              </button>
            )}
            <div className="join">
              <button
                aria-label={
                  isPending
                    ? "Working…"
                    : mode === "queue"
                      ? "Queue"
                      : mode === "steer"
                        ? "Steer"
                        : "Send"
                }
                className="btn btn-primary btn-sm join-item"
                type="submit"
                disabled={isPending || (!message.trim() && !imageFile)}
              >
                <SubmitIcon
                  aria-hidden="true"
                  className={`size-4 ${isPending ? "animate-spin" : ""}`}
                />
              </button>
              {activeTurnId && (
                <SubmissionModeMenu
                  activeTurnId={activeTurnId}
                  disabled={isPending}
                  mode={mode}
                  onModeChange={setMode}
                />
              )}
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
    </div>
  );
}
