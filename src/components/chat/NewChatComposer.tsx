import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";

import {
  useCreateThread,
  useModelList,
  useProject,
  useSendMessage,
  useSetThreadGoal,
} from "../../app-server/hooks";
import { formatErrorMessage } from "../../app/error-message";
import type { v2 } from "../../protocol";
import {
  ComposerOptions,
  PermissionMenu,
  type PermissionMode,
} from "../conversation/ComposerOptions";
import { ComposerSettings } from "../conversation/ComposerSettings";
import { useComposerSelection } from "../conversation/useComposerSelection";
import { AttachmentPreview } from "../common/AttachmentPreview";
import { useImageAttachment } from "../common/useImageAttachment";

type NewChatComposerProps = {
  projectId?: string;
};

export function NewChatComposer({ projectId }: NewChatComposerProps) {
  const navigate = useNavigate();
  const models = useModelList();
  const project = useProject(projectId ?? "");
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const setGoal = useSetThreadGoal();
  const { effort, model, setEffort, setModel } = useComposerSelection(
    models.data?.data ?? [],
  );
  const [message, setMessage] = useState("");
  const [goalMode, setGoalMode] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [permissionMode, setPermissionMode] = useState<PermissionMode>("ask");
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
        ...(projectId ? { projectId } : {}),
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
        const input: v2.UserInput[] = text
          ? [{ type: "text", text, text_elements: [] }]
          : [];
        if (imageFile) {
          const dataUrl = await readImage(imageFile);
          input.unshift({ type: "image", url: dataUrl });
        }
        await sendMessage.mutateAsync({
          threadId: thread.thread.id,
          input,
          turnTrigger: planMode ? "plan" : null,
        });
      }
      setMessage("");
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

  const isPending =
    createThread.isPending || sendMessage.isPending || setGoal.isPending;
  const isProjectLoading = Boolean(projectId && project.isLoading);
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
      <form
        className="mx-auto w-full max-w-3xl rounded-box border border-base-300 bg-base-100 p-3 shadow-sm"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <textarea
          aria-label="Message"
          className="textarea textarea-ghost min-h-24 w-full resize-none"
          disabled={isPending}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask Ruxex to work on something…"
          value={message}
        />
        <input
          ref={attachmentInput}
          accept="image/*"
          aria-label="Image attachment"
          className="hidden"
          onChange={handleAttachmentChange}
          type="file"
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
              onAttach={() => attachmentInput.current?.click()}
              onGoalModeChange={() => setGoalMode((value) => !value)}
              onPlanModeChange={() => setPlanMode((value) => !value)}
              planMode={planMode}
            />
            <PermissionMenu
              disabled={isPending}
              mode={permissionMode}
              onModeChange={setPermissionMode}
            />
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
              aria-label={goalMode ? "Set goal" : "Send"}
              className="btn btn-primary btn-sm"
              disabled={isPending || isProjectLoading || !canSubmit}
              title={goalMode ? "Set goal" : "Send"}
              type="submit"
            >
              <PaperAirplaneIcon aria-hidden="true" className="size-4" />
              {goalMode ? "Set goal" : "Send"}
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
  );
}
