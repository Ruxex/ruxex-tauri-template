import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  MicrophoneIcon,
  PaperAirplaneIcon,
  PlusIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import {
  useCreateThread,
  useModelList,
  useProject,
  useProjectList,
  useSendMessage,
} from "../../app-server/hooks";
import { formatErrorMessage } from "../../app/error-message";
import type { v2 } from "../../protocol";
import { useImageAttachment } from "../common/useImageAttachment";
import { ProjectSelector } from "../tasks/ProjectSelector";

type NewChatComposerProps = {
  projectId?: string;
  presentation?: "form" | "chat";
};

type PermissionMode = "workspace" | "read-only" | "full-access";

export function NewChatComposer({
  projectId,
  presentation = "form",
}: NewChatComposerProps) {
  const navigate = useNavigate();
  const models = useModelList();
  const projects = useProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? "");
  const project = useProject(selectedProjectId);
  const createThread = useCreateThread();
  const sendMessage = useSendMessage();
  const [model, setModel] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("");
  const [message, setMessage] = useState("");
  const [permissionMode, setPermissionMode] =
    useState<PermissionMode>("workspace");
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

  useEffect(() => {
    setSelectedProjectId(projectId ?? "");
  }, [projectId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      (!message.trim() && !imageFile) ||
      createThread.isPending ||
      sendMessage.isPending
    ) {
      return;
    }
    try {
      const root = project.data?.project.roots[0]?.path;
      const permissionSettings = {
        workspace: {
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
        ...(reasoningEffort
          ? { config: { model_reasoning_effort: reasoningEffort } }
          : {}),
      });
      const input: v2.UserInput[] = message.trim()
        ? [{ type: "text" as const, text: message.trim(), text_elements: [] }]
        : [];
      if (imageFile) {
        const dataUrl = await readImage(imageFile);
        input.unshift({ type: "image", url: dataUrl });
      }
      await sendMessage.mutateAsync({
        threadId: thread.thread.id,
        input,
      });
      setMessage("");
      resetAttachment();
      navigate(`/chat/${thread.thread.id}`);
    } catch (submitError) {
      // The mutation state renders the error below the form.
      if (
        submitError instanceof Error &&
        submitError.message.includes("image")
      ) {
        setAttachmentError(submitError.message);
      }
    }
  }

  const isPending = createThread.isPending || sendMessage.isPending;
  const isProjectLoading = Boolean(selectedProjectId && project.isLoading);
  const error = attachmentError ?? createThread.error ?? sendMessage.error;

  if (presentation === "chat") {
    return (
      <div className="flex min-h-full flex-col">
        <div className="flex flex-1 items-center justify-center px-4 pb-8">
          <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Let&apos;s get started
          </h1>
        </div>
        <form
          className="mx-auto w-full max-w-3xl rounded-xl border border-base-300 bg-base-100 p-3 shadow-sm"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <textarea
            className="textarea textarea-ghost min-h-24 w-full resize-none text-base"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
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
            <div className="mt-2 flex items-center gap-2 text-sm text-base-content/70">
              <span className="min-w-0 truncate">{imageFile.name}</span>
              <button
                className="btn btn-ghost btn-xs btn-circle text-error"
                type="button"
                onClick={clearAttachment}
                aria-label="Remove image attachment"
                title="Remove image attachment"
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                className="btn btn-ghost btn-sm btn-circle"
                type="button"
                onClick={() => attachmentInput.current?.click()}
                disabled={isPending}
                aria-label="Attach image"
                title="Attach image"
              >
                <PlusIcon aria-hidden="true" className="size-5" />
              </button>
              <ShieldCheckIcon
                aria-hidden="true"
                className="ml-1 size-4 text-base-content/60"
              />
              <select
                className="select select-ghost select-sm max-w-44"
                value={permissionMode}
                onChange={(event) =>
                  setPermissionMode(event.target.value as PermissionMode)
                }
                disabled={isPending}
                aria-label="Permissions"
              >
                <option value="workspace">Ask before changes</option>
                <option value="read-only">Read-only</option>
                <option value="full-access">Full access</option>
              </select>
            </div>
            <ProjectSelector
              disabled={isPending}
              isError={projects.isError}
              isLoading={projects.isLoading}
              onChange={setSelectedProjectId}
              projects={projects.data?.data ?? []}
              value={selectedProjectId}
            />
            <div className="ml-auto flex items-center gap-1">
              <select
                className="select select-ghost select-sm min-w-36"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={isPending}
                aria-label="Model"
              >
                <option value="">Default model</option>
                {models.data?.data.map((item) => (
                  <option key={item.id} value={item.model}>
                    {item.displayName}
                  </option>
                ))}
              </select>
              <select
                className="select select-ghost select-sm"
                value={reasoningEffort}
                onChange={(event) => setReasoningEffort(event.target.value)}
                disabled={isPending}
                aria-label="Reasoning"
              >
                <option value="">Default reasoning</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                type="button"
                disabled
                aria-label="Voice input"
                title="Voice input is not available yet"
              >
                <MicrophoneIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
            <button
              className="btn btn-primary btn-circle size-10"
              disabled={
                isPending || isProjectLoading || (!message.trim() && !imageFile)
              }
              type="submit"
              aria-label="Send message"
              title="Send message"
            >
              <PaperAirplaneIcon aria-hidden="true" className="size-4" />
            </button>
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form
        className="rounded-xl border border-base-300 bg-base-100 px-5 py-7 shadow-sm sm:px-7"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="mb-6 border-b border-base-300 pb-5">
          <h1 className="text-3xl font-semibold tracking-tight">New task</h1>
        </div>
        <div className="grid gap-5">
          <ProjectSelector
            disabled={isPending}
            isError={projects.isError}
            isLoading={projects.isLoading}
            onChange={setSelectedProjectId}
            projects={projects.data?.data ?? []}
            value={selectedProjectId}
          />
          <label className="form-control">
            <span className="label-text font-medium">Model</span>
            <select
              className="select select-bordered mt-2 min-h-11"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              <option value="">Use the default model</option>
              {models.data?.data.map((item) => (
                <option key={item.id} value={item.model}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text font-medium">Reasoning</span>
            <select
              className="select select-bordered mt-2 min-h-11"
              value={reasoningEffort}
              onChange={(event) => setReasoningEffort(event.target.value)}
            >
              <option value="">Use the default reasoning</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text font-medium">Permissions</span>
            <select
              aria-label="Permissions"
              className="select select-bordered mt-2 min-h-11"
              disabled={isPending}
              onChange={(event) =>
                setPermissionMode(event.target.value as PermissionMode)
              }
              value={permissionMode}
            >
              <option value="workspace">Ask before changes</option>
              <option value="read-only">Read-only</option>
              <option value="full-access">Full access</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text font-medium">Message</span>
            <textarea
              className="textarea textarea-bordered mt-2 min-h-40"
              placeholder="What would you like to work on?"
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>
          {error && (
            <p className="text-sm text-error" role="alert">
              {formatErrorMessage(error)}
            </p>
          )}
          <div className="flex justify-end">
            <button
              className="btn btn-primary min-h-11"
              disabled={isPending || isProjectLoading}
              type="submit"
            >
              {isPending ? "Starting…" : "Start task"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
