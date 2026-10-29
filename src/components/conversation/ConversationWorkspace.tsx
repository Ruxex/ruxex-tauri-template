import {
  useAppServerEvents,
  useThreadConversation,
} from "../../app-server/hooks";
import {
  rejectServerRequestWithMessage,
  resolveServerRequest,
} from "../../app-server/api";
import { Composer } from "./Composer";
import { mergeConversationItems } from "./conversation-model";
import { TaskActivityTimeline } from "../tasks/TaskActivityTimeline";

export function ConversationWorkspace({ threadId }: { threadId: string }) {
  const conversation = useThreadConversation(threadId);
  const events = useAppServerEvents();
  const liveThread = events.threads[threadId];

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
    liveThread?.status,
  );
  const latestTurn = conversation.data.turns.data.at(-1);
  const pendingRequests = Object.values(
    events.pendingServerRequests ?? {},
  ).filter((request) => request.threadId === threadId);
  const turnError =
    liveThread?.completedTurn?.error ??
    (latestTurn?.status === "failed" ? latestTurn.error : null);
  async function handleResolve(requestId: string | number, result: unknown) {
    await resolveServerRequest(requestId, result);
  }

  async function handleReject(requestId: string | number, message: string) {
    await rejectServerRequestWithMessage(requestId, message);
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
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
        liveStatus={liveThread?.status}
        onReject={handleReject}
        onResolve={handleResolve}
        pendingRequests={pendingRequests}
      />
      <div className="shrink-0 bg-base-200 pt-3">
        <Composer
          threadId={threadId}
          activeTurnId={liveThread?.activeTurnId ?? null}
        />
      </div>
    </div>
  );
}
