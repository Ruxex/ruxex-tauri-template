import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useBranding } from "../../app/branding-context";
import {
  rejectServerRequestWithMessage,
  resolveServerRequest,
} from "../../app-server/api";
import {
  useAppServerEvents,
  useRetainThreadState,
  useThreadConversation,
} from "../../app-server/hooks";
import { ChatActivityTimeline } from "../chats/ChatActivityTimeline";
import { mergeConversationItems } from "../conversation/conversation-model";

export function SubagentConversationPane({ threadId }: { threadId: string }) {
  const { t } = useTranslation("conversation");
  const branding = useBranding();
  const conversation = useThreadConversation(threadId);
  const events = useAppServerEvents();
  const liveThread = events.threads[threadId];
  useRetainThreadState(threadId);

  const turns = conversation.data?.turns.data ?? [];
  const items = useMemo(
    () =>
      conversation.data
        ? mergeConversationItems(
            conversation.data.items.data,
            liveThread?.items ?? [],
            liveThread?.status,
            turns,
            { assistantName: branding?.assistantName, translate: t },
          )
        : [],
    [
      branding?.assistantName,
      conversation.data,
      liveThread?.items,
      liveThread?.status,
      t,
      turns,
    ],
  );
  const pendingRequests = useMemo(
    () =>
      Object.values(events.pendingServerRequests).filter(
        (request) => request.threadId === threadId,
      ),
    [events.pendingServerRequests, threadId],
  );
  const onResolve = useCallback(
    (requestId: string | number, result: unknown) =>
      resolveServerRequest(requestId, result),
    [],
  );
  const onReject = useCallback(
    (requestId: string | number, message: string) =>
      rejectServerRequestWithMessage(requestId, message),
    [],
  );

  if (conversation.isLoading || conversation.isPending) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-base-content/60">
        {t("loadingSubagent")}
      </div>
    );
  }

  if (conversation.isError || !conversation.data) {
    return (
      <div className="p-4">
        <div className="alert alert-error" role="alert">
          <span>{t("unableToLoadThisSubagent")}</span>
          <button
            className="btn btn-sm"
            disabled={conversation.isFetching}
            onClick={() => void conversation.resync().catch(() => undefined)}
            type="button"
          >
            {conversation.isFetching ? t("retrying") : t("retry")}
          </button>
        </div>
      </div>
    );
  }

  const latestTurn = turns.at(-1);
  const liveStatus =
    liveThread?.status ??
    (conversation.data.thread.status.type === "active" ? "running" : undefined);
  const workingTurnId = liveThread?.activeTurnId ?? null;
  const completedTurn =
    liveThread?.completedTurn ??
    (!liveThread?.activeTurnId && latestTurn?.status !== "inProgress"
      ? (latestTurn ?? null)
      : null);
  const workingStartedAt = liveThread?.activeTurnId
    ? (turns.find((turn) => turn.id === liveThread.activeTurnId)?.startedAt ??
      null)
    : null;

  return (
    <div
      className="h-full min-h-full overflow-y-auto overscroll-contain"
      data-conversation-scroll="true"
    >
      <ChatActivityTimeline
        connected={events.connected}
        completedTurn={completedTurn}
        items={items}
        liveStatus={liveStatus}
        onReject={(requestId, message) => onReject(requestId, message)}
        onResolve={(requestId, result) => onResolve(requestId, result)}
        pendingRequests={pendingRequests}
        turns={turns}
        workingStartedAt={workingStartedAt}
        workingTurnId={workingTurnId}
      />
    </div>
  );
}
