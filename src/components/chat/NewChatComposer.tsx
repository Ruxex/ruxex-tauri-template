import { PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBranding } from "../../app/branding-context";
import { formatErrorMessage } from "../../app/error-message";
import {
  useCollaborationModes,
  useCreateThread,
  useModelList,
  useProject,
  useProjectList,
  useSendMessage,
  useSetThreadGoal,
} from "../../app-server/hooks";
import type { v2 } from "../../protocol";
import { ProjectSelector } from "../chats/ProjectSelector";
import { useImageAttachment } from "../common/useImageAttachment";
import {
  ComposerOptions,
  PermissionMenu,
  type PermissionMode,
} from "../conversation/ComposerOptions";
import { ComposerSettings } from "../conversation/ComposerSettings";
import { planCollaborationMode } from "../conversation/collaboration-model";
import { isComposerSubmitShortcut } from "../conversation/composer-model";
import { ComposerTextInput } from "../conversation/ComposerTextInput";
import { SelectedComposerSkill } from "../conversation/SelectedComposerSkill";
import { SlashCommandPalette } from "../conversation/SlashCommandPalette";
import {
  getSlashCommandInput,
  type SlashCommandId,
  selectSlashCommand,
  selectSlashSkill,
} from "../conversation/slash-command";
import { useComposerSelection } from "../conversation/useComposerSelection";
import { useComposerSkills } from "../conversation/useComposerSkills";
import { NewProjectDialog } from "../projects/NewProjectDialog";

type NewChatComposerProps = {
  projectId?: string;
};

export function NewChatComposer({ projectId }: NewChatComposerProps) {
  const branding = useBranding();
  const navigate = useNavigate();
  const models = useModelList();
  const { skills, visibleSkills } = useComposerSkills();
  const collaborationModes = useCollaborationModes();
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? "");
  const [message, setMessage] = useState("");
  const [goalMode, setGoalMode] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
  const [selectedSkill, setSelectedSkill] = useState<Pick<
    v2.SkillMetadata,
    "name" | "path" | "interface"
  > | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const editorRef = useRef<HTMLElement>(null);
  const project = useProject(selectedProjectId);
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const setGoal = useSetThreadGoal();
  const { effort, model, setEffort, setModel } = useComposerSelection(
    models.data?.data ?? [],
  );
  const planModeRequest = planCollaborationMode(
    collaborationModes.data?.data ?? [],
    model,
    effort,
  );
  const slashCommandInput = getSlashCommandInput(message);
  const showSlashCommands = slashCommandInput !== null && !goalMode;

  const {
    attachmentError,
    attachmentInput,
    clearAttachment,
    handleAttachmentChange,
    imageFile,
    readImage,
    resetAttachment,
    setAttachmentError,
  } = useImageAttachment();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (
      (!text && !imageFile) ||
      (goalMode && !text) ||
      createThread.isPending ||
      sendMessage.isPending ||
      setGoal.isPending
    ) {
      return;
    }

    try {
      const root = project.data?.project.roots[0]?.path;
      const permissionSettings = {
        ask: {
          approvalPolicy: "on-request" as const,
          sandbox: "workspace-write" as const,
        },
        "read-only": {
          approvalPolicy: "on-request" as const,
          sandbox: "read-only" as const,
        },
        "full-access": {
          approvalPolicy: "never" as const,
          sandbox: "danger-full-access" as const,
        },
      }[permissionMode];
      const thread = await createThread.mutateAsync({
        ...(model ? { model } : {}),
        ...(selectedProjectId ? { projectId: selectedProjectId } : {}),
        ...(root ? { cwd: root } : {}),
        ...permissionSettings,
        ...(effort ? { config: { model_reasoning_effort: effort } } : {}),
      });

      if (goalMode) {
        await setGoal.mutateAsync({
          threadId: thread.thread.id,
          objective: text,
          status: "active",
        });
      } else {
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
          input.push({ type: "text", text, text_elements: [] });
        }
        if (imageFile) {
          const dataUrl = await readImage(imageFile);
          input.unshift({ type: "image", url: dataUrl });
        }
        await sendMessage.mutateAsync({
          threadId: thread.thread.id,
          input,
          ...(planMode ? { collaborationMode: planModeRequest } : {}),
        });
      }
      setMessage("");
      setSelectedSkill(null);
      resetAttachment();
      navigate(`/chat/${thread.thread.id}`);
    } catch (submitError) {
      if (
        submitError instanceof Error &&
        submitError.message.toLowerCase().includes("image")
      ) {
        setAttachmentError(submitError.message);
      }
    }
  }

  function handleMessageKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!isComposerSubmitShortcut(event)) {
      return;
    }
    event.preventDefault();
    event.currentTarget.closest("form")?.requestSubmit();
  }

  function handleSlashCommandSelect(command: SlashCommandId) {
    const selection = selectSlashCommand(message, command);
    if (selection.kind !== "goal") {
      return;
    }
    setGoalMode(true);
    setSelectedSkill(null);
    setMessage(selection.message);
    editorRef.current?.focus();
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

  const isPending =
    createThread.isPending || sendMessage.isPending || setGoal.isPending;
  const isProjectLoading = Boolean(selectedProjectId && project.isLoading);
  const error =
    attachmentError ?? createThread.error ?? sendMessage.error ?? setGoal.error;
  const canSubmit =
    Boolean(message.trim() || imageFile) && !(goalMode && !message.trim());

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 items-center justify-center px-4 pb-8">
        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Let&apos;s get started
        </h1>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-1 w-fit max-w-full rounded-box border border-base-300 bg-base-100 px-2 py-1.5">
          <ProjectSelector
            disabled={isPending}
            isError={projects.isError}
            isLoading={projects.isLoading}
            onChange={setSelectedProjectId}
            onCreateProject={() => setShowNewProjectDialog(true)}
            projects={projects.data?.data ?? []}
            value={selectedProjectId}
          />
        </div>
        {showSlashCommands && (
          <SlashCommandPalette
            commands={["goal"]}
            disabled={isPending}
            onDismiss={() => editorRef.current?.focus()}
            onSelect={handleSlashCommandSelect}
            onSelectSkill={handleSlashSkillSelect}
            query={slashCommandInput?.query}
            skills={visibleSkills}
            skillsError={
              skills.isError ? formatErrorMessage(skills.error) : null
            }
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
                onAttach={() => attachmentInput.current?.click()}
                onGoalModeChange={() => {
                  setGoalMode((value) => !value);
                  setSelectedSkill(null);
                }}
                onPlanModeChange={() => setPlanMode((value) => !value)}
                planModeDisabled={!planModeRequest}
                planMode={planMode}
              />
              {selectedSkill && (
                <SelectedComposerSkill
                  onRemove={() => setSelectedSkill(null)}
                  skill={selectedSkill}
                />
              )}
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
              <PermissionMenu
                disabled={isPending}
                mode={permissionMode}
                onModeChange={setPermissionMode}
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
                    onClick={() => setPlanMode(false)}
                    type="button"
                  >
                    <XMarkIcon aria-hidden="true" className="size-3" />
                  </button>
                  Plan
                </span>
              )}
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <ComposerSettings
                disabled={isPending}
                effort={effort}
                model={model}
                models={models.data?.data ?? []}
                onEffortChange={setEffort}
                onModelChange={setModel}
              />
              <button
                aria-label="Send"
                className="btn btn-primary btn-sm"
                disabled={isPending || isProjectLoading || !canSubmit}
                title="Send"
                type="submit"
              >
                <PaperAirplaneIcon aria-hidden="true" className="size-4" />
                Send
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-sm text-error" role="alert">
              {formatErrorMessage(error)}
            </p>
          )}
        </form>
      </div>
      {showNewProjectDialog && (
        <NewProjectDialog
          onClose={() => setShowNewProjectDialog(false)}
          onCreated={setSelectedProjectId}
        />
      )}
    </div>
  );
}
