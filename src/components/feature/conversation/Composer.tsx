import { useTranslation } from "react-i18next";
import {
  ArrowPathIcon,
  ArrowUturnRightIcon,
  PaperAirplaneIcon,
  QueueListIcon,
  StopIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { type FormEvent, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { useBranding } from "@/app/branding-context";
import { formatErrorMessage } from "@/app/error-message";
import type { PendingServerRequest } from "@/app-server/event-reducer";
import { useCollaborationModes, useModelList } from "@/app-server/hooks";
import type { v2 } from "@/protocol";
import { buildChatUserInputResponse } from "@/components/composite/approvals/approval-model";
import { useImageAttachment } from "@/components/base/common/useImageAttachment";
import { ComposerOptions, PermissionMenu, type PermissionMode, SubmissionModeMenu } from "./ComposerOptions";
import { ComposerSettings } from "./ComposerSettings";
import { ComposerTextInput } from "./ComposerTextInput";
import { planCollaborationMode } from "./collaboration-model";
import type { SubmissionMode } from "./composer-model";
import {
  buildComposerSubmission,
  buildImageUserInput,
  isComposerSubmitShortcut,
  permissionModeSettings,
} from "./composer-model";
import { buildUserTextInput } from "./conversation-model";
import { SelectedComposerSkill } from "./SelectedComposerSkill";
import { SlashCommandPalette, type SlashCommandPaletteHandle } from "./SlashCommandPalette";
import type { SlashCommandId, SlashCommandToken } from "./slash-command";
import { useComposerActions } from "./useComposerActions";
import { useComposerSelection } from "./useComposerSelection";
import { useComposerSkills } from "./useComposerSkills";

type ComposerProps = {
  threadId: string;
  activeTurnId: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
  initialMessage?: string;
  onMessageSent?: () => void;
  pendingUserInputRequests?: PendingServerRequest[];
  onResolveUserInput?: (requestId: string | number, result: unknown) => Promise<void>;
};

export function Composer({
  threadId,
  activeTurnId,
  model: initialModel = null,
  reasoningEffort: initialEffort = null,
  initialMessage,
  onMessageSent,
  pendingUserInputRequests = [],
  onResolveUserInput,
}: ComposerProps) {
  const { t } = useTranslation("conversation");

  const branding = useBranding();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<SubmissionMode>("send");
  const [goalMode, setGoalMode] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Pick<v2.SkillMetadata, "name" | "path" | "interface"> | null>(
    null,
  );
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const [inputRequestError, setInputRequestError] = useState<string | null>(null);
  const editorRef = useRef<HTMLElement>(null);
  const slashPaletteRef = useRef<SlashCommandPaletteHandle>(null);
  const removeSlashTokenRef = useRef<(() => void) | null>(null);
  const [slashCommandInput, setSlashCommandInput] = useState<SlashCommandToken | null>(null);
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
  const planModeRequest = planCollaborationMode(collaborationModes.data?.data ?? [], model, effort);
  const actions = useComposerActions(threadId);
  const { isPending } = actions;
  const pendingInputRequest = pendingUserInputRequests.length === 1 ? pendingUserInputRequests[0] : null;
  const pendingInputParams = pendingInputRequest?.request.params as
    | { questions?: Array<{ question: string; isSecret?: boolean }> }
    | undefined;
  const pendingInputQuestions = pendingInputParams?.questions ?? [];
  const canAnswerFromComposer =
    pendingUserInputRequests.length === 1 &&
    pendingInputQuestions.length === 1 &&
    typeof onResolveUserInput === "function" &&
    !pendingInputQuestions[0]?.isSecret;
  const inputRequestBlockReason = pendingUserInputRequests.length
    ? pendingUserInputRequests.length !== 1 || pendingInputQuestions.length !== 1
      ? t("answerEachQuestionInTheRequestCardAboveBeforeSendingAnotherMessage")
      : pendingInputQuestions[0]?.isSecret
        ? t("useThePrivateAnswerFieldInTheRequestCardAbove")
        : imageFile
          ? t("removeTheImageAttachmentToAnswerThisRequest")
          : !onResolveUserInput
            ? t("answerTheRequestCardAboveBeforeSendingAnotherMessage")
            : null
    : null;
  const composerInputBlocked =
    pendingUserInputRequests.length > 0 && (!canAnswerFromComposer || Boolean(inputRequestBlockReason));
  const showSlashCommands = slashCommandInput !== null && !goalMode;

  const setSlashContext = useCallback(
    (input: SlashCommandToken | null, removeToken: (() => void) | null) => {
      setSlashCommandInput(input);
      removeSlashTokenRef.current = removeToken;
      if (!editorRef.current) return;
      if (!input || goalMode) {
        editorRef.current.removeAttribute("role");
        editorRef.current.removeAttribute("aria-haspopup");
        editorRef.current.removeAttribute("aria-autocomplete");
        editorRef.current.removeAttribute("aria-expanded");
        editorRef.current.removeAttribute("aria-controls");
        editorRef.current.removeAttribute("aria-activedescendant");
        return;
      }
      editorRef.current.setAttribute("role", "combobox");
      editorRef.current.setAttribute("aria-haspopup", "listbox");
      editorRef.current.setAttribute("aria-autocomplete", "list");
      editorRef.current.setAttribute("aria-expanded", "true");
      editorRef.current.setAttribute("aria-controls", "slash-command-palette");
    },
    [goalMode],
  );

  const closeSlashPalette = useCallback(() => {
    setSlashContext(null, null);
  }, [setSlashContext]);

  const handleActiveOptionChange = useCallback((id: string | null) => {
    if (id) editorRef.current?.setAttribute("aria-activedescendant", id);
    else editorRef.current?.removeAttribute("aria-activedescendant");
  }, []);

  useEffect(() => {
    if (initialMessage !== undefined) {
      setMessage(initialMessage);
    }
  }, [initialMessage]);

  const SubmitIcon = isPending
    ? ArrowPathIcon
    : pendingUserInputRequests.length > 0
      ? PaperAirplaneIcon
      : mode === "queue"
        ? QueueListIcon
        : mode === "steer"
          ? ArrowUturnRightIcon
          : PaperAirplaneIcon;

  function handleModelChange(value: string) {
    setModel(value);
    void actions.updateSettings({ threadId, model: value || null }).catch(() => undefined);
  }

  function handleEffortChange(value: string) {
    setEffort(value);
    void actions.updateSettings({ threadId, effort: value || null }).catch(() => undefined);
  }

  function handlePermissionChange(value: PermissionMode) {
    setPermissionMode(value);
    void actions.updateSettings({ threadId, ...permissionModeSettings(value) }).catch(() => undefined);
  }

  function handlePlanModeChange() {
    setPlanMode((value) => !value);
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (showSlashCommands) {
      slashPaletteRef.current?.handleKeyDown(event);
      if (event.defaultPrevented) return;
    }
    if (!isComposerSubmitShortcut(event)) {
      return;
    }
    event.preventDefault();
    event.currentTarget.closest("form")?.requestSubmit();
  }

  async function handleSlashCommandSelect(command: SlashCommandId) {
    if (command === "goal") {
      removeSlashTokenRef.current?.();
      setGoalMode(true);
      closeSlashPalette();
      return;
    }

    try {
      if (command === "archive") {
        await actions.archive();
      } else {
        await actions.compact();
      }
      setMessage("");
      closeSlashPalette();
      editorRef.current?.focus();
    } catch {
      // Mutation state renders the error below the composer.
    }
  }

  function handleSlashSkillSelect(skill: v2.SkillMetadata) {
    removeSlashTokenRef.current?.();
    setSelectedSkill({
      name: skill.name,
      path: skill.path,
      interface: skill.interface,
    });
    closeSlashPalette();
    editorRef.current?.focus();
  }

  useEffect(() => {
    if (!showSlashCommands) return;
    const isPaletteOrEditorTarget = (target: EventTarget | null) =>
      target instanceof Node &&
      (editorRef.current?.contains(target) ||
        (target instanceof Element && target.closest("[data-slash-command-palette='true']")));
    const handlePointerDown = (event: PointerEvent) => {
      if (isPaletteOrEditorTarget(event.target)) return;
      closeSlashPalette();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isPaletteOrEditorTarget(event.target)) return;
      closeSlashPalette();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [closeSlashPalette, showSlashCommands]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if ((!text && !imageFile) || isPending || composerInputBlocked || (goalMode && !text)) {
      return;
    }
    if (pendingInputRequest && onResolveUserInput) {
      const result = buildChatUserInputResponse(pendingInputRequest.request, text);
      if (!result) return;
      try {
        await onResolveUserInput(pendingInputRequest.requestId, result);
        setMessage("");
        setGoalMode(false);
        setSelectedSkill(null);
        resetAttachment();
        setInputRequestError(null);
      } catch (error) {
        setInputRequestError(formatErrorMessage(error));
      }
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
        const submission = buildComposerSubmission({
          threadId,
          input,
          mode,
          activeTurnId,
          model,
          effort,
          planMode,
          collaborationMode: planModeRequest,
          goal: text,
        });
        if (submission?.kind !== "goal") return;
        await actions.submit(submission);
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
      const submission = buildComposerSubmission({
        threadId,
        input,
        mode,
        activeTurnId,
        model,
        effort,
        planMode,
        collaborationMode: planModeRequest,
      });
      if (!submission) return;
      await actions.submit(submission);
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
          disabled={isPending || composerInputBlocked}
          id="slash-command-palette"
          key={slashCommandInput.query}
          onActiveOptionChange={handleActiveOptionChange}
          onDismiss={closeSlashPalette}
          onSelectSkill={handleSlashSkillSelect}
          onSelect={(command) => void handleSlashCommandSelect(command)}
          query={slashCommandInput?.query}
          ref={slashPaletteRef}
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
          disabled={isPending || composerInputBlocked}
          handleAttachmentChange={handleAttachmentChange}
          imageFile={imageFile}
          onChange={setMessage}
          onEditorReady={(element) => {
            editorRef.current = element;
            if (showSlashCommands) {
              element.setAttribute("role", "combobox");
              element.setAttribute("aria-haspopup", "listbox");
              element.setAttribute("aria-autocomplete", "list");
              element.setAttribute("aria-expanded", "true");
              element.setAttribute("aria-controls", "slash-command-palette");
            }
          }}
          onSlashCommandContext={setSlashContext}
          onKeyDown={handleMessageKeyDown}
          onRemoveImage={clearAttachment}
          placeholder={
            pendingUserInputRequests.length > 0
              ? canAnswerFromComposer
                ? t("answerTheQuestionAbove")
                : t("answerTheQuestionsInTheRequestCardAbove")
              : branding
                ? t("askNamedAssistant", { name: branding.assistantName })
                : t("askAssistant")
          }
          value={message}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ComposerOptions
              disabled={isPending || composerInputBlocked}
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
            {selectedSkill && <SelectedComposerSkill onRemove={() => setSelectedSkill(null)} skill={selectedSkill} />}
            <PermissionMenu
              disabled={isPending || composerInputBlocked}
              mode={permissionMode}
              onModeChange={handlePermissionChange}
            />
            {planMode && (
              <span aria-label={t("planModeActive")} className="badge badge-secondary badge-sm gap-1" role="status">
                <button
                  aria-label={t("disablePlanMode")}
                  className="btn btn-ghost btn-circle btn-xs size-4 min-h-4 p-0 text-secondary-content hover:bg-secondary-content/10"
                  onClick={handlePlanModeChange}
                  type="button"
                >
                  <XMarkIcon aria-hidden="true" className="size-3" />
                </button>
                {t("plan")}
              </span>
            )}
            {goalMode && (
              <span aria-label={t("goalModeActive")} className="badge badge-primary badge-sm gap-1" role="status">
                <button
                  aria-label={t("disableGoalMode")}
                  className="btn btn-ghost btn-circle btn-xs size-4 min-h-4 p-0 text-primary-content hover:bg-primary-content/10"
                  onClick={() => setGoalMode(false)}
                  type="button"
                >
                  <XMarkIcon aria-hidden="true" className="size-3" />
                </button>
                {t("goal")}
              </span>
            )}
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <ComposerSettings
              disabled={isPending || composerInputBlocked}
              effort={effort}
              model={model}
              models={models.data?.data ?? []}
              onEffortChange={handleEffortChange}
              onModelChange={handleModelChange}
            />
            {activeTurnId && (
              <button
                aria-label={t("stop")}
                className="btn btn-error btn-sm btn-outline btn-square"
                title={t("stop")}
                type="button"
                onClick={() => void actions.interrupt(activeTurnId)}
                disabled={isPending}
              >
                <StopIcon aria-hidden="true" className="size-4" />
              </button>
            )}
            <div className="join">
              <button
                aria-label={
                  pendingUserInputRequests.length > 0
                    ? canAnswerFromComposer
                      ? t("submitAnswer")
                      : t("answerRequestAbove")
                    : isPending
                      ? t("working")
                      : mode === "queue"
                        ? t("queue")
                        : mode === "steer"
                          ? t("steer")
                          : t("send")
                }
                className="btn btn-primary btn-sm btn-square join-item"
                type="submit"
                disabled={isPending || composerInputBlocked || (!message.trim() && !imageFile)}
              >
                <SubmitIcon aria-hidden="true" className={`size-4 ${isPending ? "animate-spin" : ""}`} />
              </button>
              {activeTurnId && pendingUserInputRequests.length === 0 && (
                <SubmissionModeMenu
                  activeTurnId={activeTurnId}
                  disabled={isPending || composerInputBlocked}
                  mode={mode}
                  onModeChange={setMode}
                />
              )}
            </div>
          </div>
        </div>
        {pendingUserInputRequests.length > 0 && (
          <p className="mt-2 text-sm text-base-content/70" role="status">
            {inputRequestBlockReason ?? t("sendingHereWillAnswerThePendingQuestion")}
          </p>
        )}
        {(attachmentError || actions.error || inputRequestError) && (
          <p className="mt-2 text-sm text-error">
            {attachmentError || inputRequestError || formatErrorMessage(actions.error)}
          </p>
        )}
      </form>
    </div>
  );
}
