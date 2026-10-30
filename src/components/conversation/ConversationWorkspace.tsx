import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  rejectServerRequestWithMessage,
  resolveServerRequest,
} from "../../app-server/api";
import type { LiveConversationItem } from "../../app-server/event-reducer";
import {
  useAppServerEvents,
  useRetainThreadState,
  useRevertThread,
  useSendMessage,
  useThreadConversation,
} from "../../app-server/hooks";
import { ChatActivityTimeline } from "../chats/ChatActivityTimeline";
import { Composer } from "./Composer";
import {
  buildUserTextInput,
  type ConversationViewItem,
  mergeConversationItems,
} from "./conversation-model";

const EMPTY_LIVE_ITEMS: LiveConversationItem[] = [];

export function ConversationWorkspace({ threadId }: { threadId: string }) {
  const conversation = useThreadConversation(threadId);
  const events = useAppServerEvents();
  const wasConnected = useRef(events.connected);
  const laggedEventCount =
    events.resynchronizing && events.connected ? events.skippedEvents : 0;
  useRetainThreadState(threadId);
  const revertThread = useRevertThread();
  const sendMessage = useSendMessage();
  const liveThread = events.threads[threadId];
  const liveItems = liveThread?.items ?? EMPTY_LIVE_ITEMS;
  const liveStatus = liveThread?.status;
  const authoritativeItems = conversation.data?.items.data;
  const turns = conversation.data?.turns.data;
  const items = useMemo(
    () =>
      authoritativeItems && turns
        ? mergeConversationItems(
            authoritativeItems,
            liveItems,
            liveStatus,
            turns,
          )
        : [],
    [authoritativeItems, liveItems, liveStatus, turns],
  );
  const pendingRequests = useMemo(
    () =>
      Object.values(events.pendingServerRequests ?? {}).filter(
        (request) => request.threadId === threadId,
      ),
    [events.pendingServerRequests, threadId],
  );

  useEffect(() => {
    const reconnected =
      !wasConnected.current && events.connected && events.lastError !== null;
    const streamLagged = laggedEventCount > 0;
    wasConnected.current = events.connected;
    if (!reconnected && !streamLagged) {
      return;
    }
    void conversation.resync();
  }, [
    conversation.resync,
    events.connected,
    events.lastError,
    laggedEventCount,
  ]);

  const handleEdit = useCallback(
    async function handleEdit(
      item: ConversationViewItem,
      editedText: string,
    ): Promise<void> {
      if (item.type !== "userMessage" || !editedText.trim()) {
        return;
      }
      await revertThread.mutateAsync({
        threadId,
        beforeTurnId: item.turnId,
      });
      await sendMessage.mutateAsync({
        threadId,
        input: [buildUserTextInput(editedText)],
        model: conversation.data?.thread.model ?? null,
        effort: conversation.data?.thread.reasoningEffort ?? null,
        turnTrigger: null,
      });
    },
    [
      conversation.data?.thread.model,
      conversation.data?.thread.reasoningEffort,
      revertThread.mutateAsync,
      sendMessage.mutateAsync,
      threadId,
    ],
  );

  const handleResolve = useCallback(
    async (requestId: string | number, result: unknown) => {
      await resolveServerRequest(requestId, result);
    },
    [],
  );

  const handleReject = useCallback(
    async (requestId: string | number, message: string) => {
      await rejectServerRequestWithMessage(requestId, message);
    },
    [],
  );

  if (conversation.isLoading) {
    return <span className="loading loading-spinner loading-lg" />;
  }
  if (conversation.isError || !conversation.data) {
    return (
      <p className="alert alert-error">Unable to load this conversation.</p>
    );
  }

  const latestTurn = conversation.data.turns.data.at(-1);
  const turnError =
    liveThread?.completedTurn?.error ??
    (latestTurn?.status === "failed" ? latestTurn.error : null);
  const editError = revertThread.error ?? sendMessage.error;
  const canEdit =
    liveThread?.status !== "running" &&
    liveThread?.status !== "resynchronizing" &&
    !revertThread.isPending &&
    !sendMessage.isPending;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[980px] flex-col gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
      {turnError && (
        <p className="alert alert-error" role="alert">
          <span>Turn failed: {turnError.message}</span>
          {turnError.additionalDetails && (
            <span>{turnError.additionalDetails}</span>
          )}
        </p>
      )}
      {editError && (
        <p className="alert alert-error" role="alert">
          Unable to edit this message: {editError.message}
        </p>
      )}
      <ChatActivityTimeline
        connected={events.connected ?? true}
        items={items}
        liveItems={liveItems}
        liveStatus={liveStatus}
        onEdit={canEdit ? handleEdit : undefined}
        onReject={handleReject}
        onResolve={handleResolve}
        pendingRequests={pendingRequests}
      />
      <div className="sticky bottom-0 z-10 mt-auto shrink-0 bg-base-200 pt-3 pb-2">
        <Composer
          threadId={threadId}
          activeTurnId={liveThread?.activeTurnId ?? null}
          model={conversation.data.thread.model}
          reasoningEffort={conversation.data.thread.reasoningEffort}
        />
      </div>
    </div>
  );
}
