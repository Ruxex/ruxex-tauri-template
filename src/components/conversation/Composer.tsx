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
  useSkillsList,
  useSteerTurn,
  useUpdateThreadSettings,
} from "../../app-server/hooks";
import {
  filterHiddenSkills,
  getDesktopUiPolicy,
} from "../../platform/skill-policy";
import type { v2 } from "../../protocol";
import type { CollaborationMode } from "../../protocol/generated/CollaborationMode";
import { AttachmentPreview } from "../common/AttachmentPreview";
import { SkillIcon } from "../common/SkillIcon";
import { useImageAttachment } from "../common/useImageAttachment";
import { ComposerMessageInput } from "./ComposerMessageInput";
import {
  ComposerOptions,
  PermissionMenu,
  type PermissionMode,
  SubmissionModeMenu,
} from "./ComposerOptions";
import { ComposerSettings } from "./ComposerSettings";
import { collaborationModeFromMask } from "./collaboration-model";
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
  const skills = useSkillsList();
  const [hiddenSkills, setHiddenSkills] = useState<Set<string>>(
    () => new Set(),
  );
  const collaborationModes = useCollaborationModes();
  const [collaborationModeName, setCollaborationModeName] = useState("");
  const [collaborationMode, setCollaborationMode] = useState<
    CollaborationMode | null | undefined
  >(undefined);
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
  const slashCommandInput = getSlashCommandInput(message);
  const showSlashCommands = slashCommandInput !== null && !goalMode;

  useEffect(() => {
    if (initialMessage !== undefined) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  useEffect(() => {
    let cancelled = false;
    void getDesktopUiPolicy()
      .then((policy) => {
        if (!cancelled && policy.hiddenSkills.length > 0) {
          setHiddenSkills(new Set(policy.hiddenSkills));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleSkills = filterHiddenSkills(
    skills.data?.data.flatMap((entry) => entry.skills) ?? [],
    hiddenSkills,
  ).filter((skill) => skill.enabled);
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

  function handleCollaborationModeChange(modeName: string) {
    const mask = collaborationModes.data?.data.find(
      (option) => option.name === modeName,
    );
    const nextMode = mask ? collaborationModeFromMask(mask) : null;
    setCollaborationModeName(modeName);
    setCollaborationMode(nextMode);
    void updateSettings
      .mutateAsync({ threadId, collaborationMode: nextMode })
      .catch(() => undefined);
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
          turnTrigger: planMode ? "plan" : null,
          ...(collaborationMode !== undefined ? { collaborationMode } : {}),
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
        <ComposerMessageInput
          disabled={isPending}
          onChange={setMessage}
          onEditorReady={(element) => {
            editorRef.current = element;
          }}
          onKeyDown={handleMessageKeyDown}
          placeholder={`${branding ? `Ask ${branding.assistantName}` : "Ask the assistant"} to work on something…`}
          value={message}
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
              onGoalModeChange={() => {
                setGoalMode((value) => !value);
                setSelectedSkill(null);
              }}
              onPlanModeChange={() => setPlanMode((value) => !value)}
              onAttach={() => attachmentInput.current?.click()}
              planMode={planMode}
            />
            {selectedSkill && (
              <span
                aria-label={`Selected skill: ${selectedSkill.name}`}
                className="badge badge-primary badge-outline max-w-56 gap-1 py-3"
                role="status"
              >
                <SkillIcon className="size-3.5" skill={selectedSkill} />
                <span className="truncate">{selectedSkill.name}</span>
                <button
                  aria-label={`Remove skill ${selectedSkill.name}`}
                  className="btn btn-ghost btn-xs btn-circle -mr-1 size-5 min-h-5"
                  type="button"
                  onClick={() => setSelectedSkill(null)}
                >
                  <XMarkIcon aria-hidden="true" className="size-3" />
                </button>
              </span>
            )}
            {(goalMode || planMode) && (
              <fieldset
                aria-label="Active composer modes"
                className="flex flex-wrap items-center gap-1"
              >
                {goalMode && (
                  <span
                    aria-label="Goal mode active"
                    className="badge badge-primary badge-sm group gap-1"
                    role="status"
                  >
                    <button
                      aria-label="Disable goal mode"
                      className="btn btn-ghost btn-circle btn-xs size-4 min-h-4 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => setGoalMode(false)}
                      type="button"
                    >
                      <XMarkIcon aria-hidden="true" className="size-3" />
                    </button>
                    Goal
                  </span>
                )}
                {planMode && (
                  <span
                    aria-label="Plan mode active"
                    className="badge badge-secondary badge-sm"
                    role="status"
                  >
                    Plan
                  </span>
                )}
              </fieldset>
            )}
            <PermissionMenu
              disabled={isPending}
              mode={permissionMode}
              onModeChange={handlePermissionChange}
            />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <ComposerSettings
              collaborationModes={collaborationModes.data?.data ?? []}
              collaborationModeName={collaborationModeName}
              disabled={isPending}
              effort={effort}
              model={model}
              models={models.data?.data ?? []}
              onEffortChange={handleEffortChange}
              onCollaborationModeChange={handleCollaborationModeChange}
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
                disabled={isPending}
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
