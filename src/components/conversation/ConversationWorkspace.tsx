import {
  useAppServerEvents,
  useInterruptTurn,
  useProject,
  useResumeThread,
  useStartReview,
  useThreadConversation,
} from "../../app-server/hooks";
import {
  rejectServerRequestWithMessage,
  resolveServerRequest,
} from "../../app-server/api";
import { formatErrorMessage } from "../../app/error-message";
import { useState } from "react";
import { Composer } from "./Composer";
import { mergeConversationItems } from "./conversation-model";
import { TaskActivityTimeline } from "../tasks/TaskActivityTimeline";
import {
  TaskContextPanel,
  type TaskContextTab,
} from "../tasks/TaskContextPanel";
import { TaskHeader } from "../tasks/TaskHeader";

export function ConversationWorkspace({ threadId }: { threadId: string }) {
  const conversation = useThreadConversation(threadId);
  const events = useAppServerEvents();
  const liveThread = events.threads[threadId];
  const thread = conversation.data?.thread;
  const project = useProject(thread?.projectId ?? "");
  const interruptTurn = useInterruptTurn();
  const resumeThread = useResumeThread();
  const startReview = useStartReview();
  const [activeContextTab, setActiveContextTab] =
    useState<TaskContextTab | null>(null);

  if (conversation.isLoading) {
    return <span className="loading loading-spinner loading-lg" />;
  }
  if (conversation.isError || !conversation.data) {
    return (
      <p className="alert alert-error">Unable to load this conversation.</p>
    );
  }

  const items = mergeConversationItems(
    conversation.data.items.data,
    liveThread?.items ?? [],
  );
  const latestTurn = conversation.data.turns.data.at(-1);
  const pendingRequests = Object.values(
    events.pendingServerRequests ?? {},
  ).filter((request) => request.threadId === threadId);
  const turnError =
    liveThread?.completedTurn?.error ??
    (latestTurn?.status === "failed" ? latestTurn.error : null);
  const actionError =
    interruptTurn.error ?? resumeThread.error ?? startReview.error;

  function handleStop() {
    const turnId = liveThread?.activeTurnId;
    if (turnId) {
      void interruptTurn.mutateAsync({ threadId, turnId });
    }
  }

  function handleResume() {
    void resumeThread.mutateAsync({ threadId });
  }

  function handleStartReview() {
    setActiveContextTab("review");
    void startReview.mutateAsync({
      threadId,
      target: { type: "uncommittedChanges" },
      delivery: "inline",
    });
  }

  const changedFiles = items
    .filter((item) => item.type === "fileChange")
    .map((item) => ({
      id: item.id,
      metadata: item.metadata,
      text: item.text,
    }));

  async function handleResolve(requestId: string | number, result: unknown) {
    await resolveServerRequest(requestId, result);
  }

  async function handleReject(requestId: string | number, message: string) {
    await rejectServerRequestWithMessage(requestId, message);
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-4">
      <TaskHeader
        latestTurn={latestTurn}
        liveThread={liveThread}
        onOpenContext={setActiveContextTab}
        onResume={handleResume}
        onStartReview={handleStartReview}
        onStop={handleStop}
        pendingRequestCount={pendingRequests.length}
        projectName={project.data?.project.name}
        projectRoots={project.data?.project.roots.map((root) => root.path)}
        reconnecting={Boolean(
          events.resynchronizing || liveThread?.status === "resynchronizing",
        )}
        thread={conversation.data.thread}
      />
      {activeContextTab && (
        <TaskContextPanel
          activeTab={activeContextTab}
          branch={conversation.data.thread.gitInfo?.branch}
          changedFiles={changedFiles}
          onClose={() => setActiveContextTab(null)}
          onOpenContext={setActiveContextTab}
          onStartReview={handleStartReview}
          review={startReview}
          threadId={threadId}
          workspacePath={conversation.data.thread.cwd}
        />
      )}
      {actionError && (
        <p className="alert alert-error" role="alert">
          {formatErrorMessage(actionError)}
        </p>
      )}
      {turnError && (
        <p className="alert alert-error" role="alert">
          <span>Turn failed: {turnError.message}</span>
          {turnError.additionalDetails && (
            <span>{turnError.additionalDetails}</span>
          )}
        </p>
      )}
      <TaskActivityTimeline
        connected={events.connected ?? true}
        items={items}
        liveItems={liveThread?.items ?? []}
        onReject={handleReject}
        onResolve={handleResolve}
        pendingRequests={pendingRequests}
      />
      <Composer
        threadId={threadId}
        activeTurnId={liveThread?.activeTurnId ?? null}
      />
    </div>
  );
}
