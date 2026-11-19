import { openPath } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useBranding } from "@/app/branding-context";
import { getEditorCommandPreference } from "@/app/ui-preferences";
import { rejectServerRequestWithMessage, resolveServerRequest } from "@/app-server/api";
import type { LiveConversationItem } from "@/app-server/event-reducer";
import { clearThreadLiveItems } from "@/app-server/event-store";
import {
  useAllThreadList,
  useAppServerEvents,
  useRetainThreadState,
  useRevertThread,
  useSendMessage,
  useSubagentThreadList,
  useThreadConversation,
  useThreadTokenUsage,
} from "@/app-server/hooks";
import { useGitDiffSummary } from "@/platform/git-diff";
import { openWorkspaceInEditor } from "@/platform/native";
import { ChatActivityTimeline } from "@/components/composite/chats/ChatActivityTimeline";
import { buildSubagentRows } from "@/components/composite/thread-summary/subagent-model";
import { ThreadSummaryPanel } from "@/components/composite/thread-summary/ThreadSummaryPanel";
import { Composer } from "./Composer";
import { ConversationMinimap } from "./ConversationMinimap";
import { CurrentGoal } from "./CurrentGoal";
import { buildUserTextInput, type ConversationViewItem, mergeConversationItems } from "./conversation-model";
import { QueuedMessages } from "./QueuedMessages";

const EMPTY_LIVE_ITEMS: LiveConversationItem[] = [];

export function ConversationWorkspace({
  threadId,
  onOpenThreadDiff,
  onOpenThreadTerminal,
  onOpenSubagent,
}: {
  threadId: string;
  onOpenThreadDiff?: (target: { threadId: string; workspace: string }) => void;
  onOpenThreadTerminal?: (target: { threadId: string; cwd: string | null }) => void;
  onOpenSubagent?: (target: { threadId: string; label: string }) => void;
}) {
  const { t } = useTranslation("conversation");

  const branding = useBranding();
  const timelineRef = useRef<HTMLElement | null>(null);
  const conversation = useThreadConversation(threadId);
  const tokenUsageQuery = useThreadTokenUsage(threadId);
  const gitDiffQuery = useGitDiffSummary(conversation.data?.thread.cwd ?? null);
  const events = useAppServerEvents();
  const [isRecovering, setIsRecovering] = useState(false);
  const wasConnected = useRef(events.connected);
  const laggedEventCount = events.resynchronizing && events.connected ? events.skippedEvents : 0;
  useRetainThreadState(threadId);
  const revertThread = useRevertThread();
  const sendMessage = useSendMessage();
  const liveThread = events.threads[threadId];
  const tokenUsage = liveThread?.tokenUsage ?? tokenUsageQuery.data ?? null;
  const subagentThreadList = useSubagentThreadList(threadId);
  const subagentDescendantList = useAllThreadList({
    ancestorThreadId: threadId,
    archived: false,
    sortKey: "updated_at",
    sortDirection: "desc",
  });
  const subagentThreadIds = useMemo(
    () => new Set((subagentDescendantList.data?.data ?? []).map((thread) => thread.id)),
    [subagentDescendantList.data?.data],
  );
  const subagents = useMemo(
    () =>
      buildSubagentRows(
        subagentThreadList.data?.data ?? [],
        events.threads,
        Object.values(events.pendingServerRequests),
        t,
        {
          history: conversation.data?.items.data,
          live: liveThread?.items,
          parentUpdatedAt: conversation.data?.thread.updatedAt ?? liveThread?.lastActivityAt,
        },
      ),
    [
      events.pendingServerRequests,
      events.threads,
      conversation.data?.items.data,
      conversation.data?.thread.updatedAt,
      liveThread?.items,
      liveThread?.lastActivityAt,
      subagentThreadList.data?.data,
      t,
    ],
  );
  const subagentDescendants = useMemo(
    () =>
      buildSubagentRows(
        subagentDescendantList.data?.data ?? [],
        events.threads,
        Object.values(events.pendingServerRequests),
        t,
      ),
    [events.pendingServerRequests, events.threads, subagentDescendantList.data?.data, t],
  );
  const subagentRequestSourceLabels = useMemo(
    () => new Map(subagentDescendants.map((subagent) => [subagent.threadId, subagent.label])),
    [subagentDescendants],
  );
  const liveItems = liveThread?.items ?? EMPTY_LIVE_ITEMS;
  const liveItemsRef = useRef(liveItems);
  liveItemsRef.current = liveItems;
  const liveStatus = liveThread?.status;

  // biome-ignore lint/correctness/useExhaustiveDependencies: These values intentionally trigger scroll reset on thread and loading-state changes.
  useLayoutEffect(() => {
    const scrollContainer = timelineRef.current?.closest<HTMLElement>("[data-conversation-scroll]");
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [conversation.isLoading, conversation.isPending, threadId]);

  const authoritativeItems = conversation.data?.items.data;
  const turns = conversation.data?.turns.data;
  const latestTurn = turns?.at(-1);
  const workingTurnId = liveThread?.activeTurnId ?? null;
  const workingStartedAt = liveThread?.activeTurnId
    ? (turns?.find((turn) => turn.id === liveThread.activeTurnId)?.startedAt ?? null)
    : null;
  const completedTurn =
    liveThread?.completedTurn ??
    (!liveThread?.activeTurnId && latestTurn?.status !== "inProgress" ? (latestTurn ?? null) : null);
  const items = useMemo(
    () =>
      authoritativeItems && turns
        ? mergeConversationItems(authoritativeItems, liveItems, liveStatus, turns, {
            preferAuthoritative: isRecovering,
            assistantName: branding?.assistantName,
            translate: t,
          })
        : [],
    [authoritativeItems, branding?.assistantName, isRecovering, liveItems, liveStatus, turns, t],
  );
  const pendingRequests = useMemo(
    () =>
      Object.values(events.pendingServerRequests ?? {}).filter(
        (request) =>
          request.threadId === threadId || (request.threadId !== null && subagentThreadIds.has(request.threadId)),
      ),
    [events.pendingServerRequests, subagentThreadIds, threadId],
  );
  const pendingUserInputRequests = useMemo(
    () =>
      pendingRequests.filter(
        (request) => request.threadId === threadId && request.request.method === "item/tool/requestUserInput",
      ),
    [pendingRequests, threadId],
  );

  useEffect(() => {
    const reconnected = !wasConnected.current && events.connected && events.lastError !== null;
    const streamLagged = laggedEventCount > 0;
    wasConnected.current = events.connected;
    if (!reconnected && !streamLagged) {
      return;
    }
    let cancelled = false;
    const staleLiveItems = new Set(liveItemsRef.current);
    setIsRecovering(true);
    void conversation
      .resync()
      .then(() => {
        if (cancelled) {
          return;
        }
        clearThreadLiveItems(threadId, staleLiveItems);
        setIsRecovering(false);
      })
      .catch(() => {
        if (!cancelled) {
          setIsRecovering(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [conversation.resync, events.connected, events.lastError, laggedEventCount, threadId]);

  const handleEdit = useCallback(
    async function handleEdit(item: ConversationViewItem, editedText: string): Promise<void> {
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

  const handleResolve = useCallback(async (requestId: string | number, result: unknown) => {
    await resolveServerRequest(requestId, result);
  }, []);

  const handleReject = useCallback(async (requestId: string | number, message: string) => {
    await rejectServerRequestWithMessage(requestId, message);
  }, []);

  if (conversation.isLoading || conversation.isPending) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  if (conversation.isError || !conversation.data) {
    return (
      <div
        aria-busy={conversation.isFetching}
        className="alert alert-error flex flex-wrap items-center justify-between gap-3"
        role="alert"
      >
        <p>{t("unableToLoadThisConversationCheckYourConnectionAndTryAgain")}</p>
        <button
          className="btn btn-sm"
          disabled={conversation.isFetching}
          onClick={() => void conversation.resync().catch(() => undefined)}
          type="button"
        >
          {conversation.isFetching ? t("retrying") : t("retry")}
        </button>
      </div>
    );
  }

  const turnError = liveThread?.completedTurn?.error ?? (latestTurn?.status === "failed" ? latestTurn.error : null);
  const editError = revertThread.error ?? sendMessage.error;
  const canEdit =
    liveThread?.status !== "running" &&
    liveThread?.status !== "resynchronizing" &&
    !revertThread.isPending &&
    !sendMessage.isPending;
  const hasMinimap = items.some((item) => item.type === "userMessage");
  const gitDiff = gitDiffQuery.data ?? null;
  const workspacePath = conversation.data.thread.cwd;
  // Three-column order: minimap column, main chat column, thread summary column.
  const chatGridClasses = hasMinimap
    ? [
        "grid-cols-[minmax(0,1fr)]",
        "@min-[64rem]/chat:grid-cols-[minmax(0,1fr)_minmax(0,53rem)]",
        "@min-[80rem]/chat:grid-cols-[minmax(3rem,1fr)_minmax(0,53rem)_minmax(16rem,1fr)]",
      ]
    : [
        "grid-cols-[minmax(0,1fr)]",
        "@min-[64rem]/chat:grid-cols-[minmax(0,53rem)]",
        "@min-[80rem]/chat:grid-cols-[minmax(0,53rem)_minmax(0,24rem)]",
        "@min-[96rem]/chat:grid-cols-[minmax(0,53rem)_minmax(0,1fr)]",
      ];

  return (
    <div
      className={[
        "chat-workspace mx-auto grid min-h-full w-full justify-center gap-4 px-4 pt-4 sm:px-6 sm:pt-6",
        ...chatGridClasses,
        ...(hasMinimap ? ["chat-workspace--has-minimap"] : []),
        "chat-workspace--has-summary",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="chat-workspace"
    >
      {hasMinimap && (
        /* Left column: minimap column; this component is the minimap. */
        <ConversationMinimap items={items} timelineRef={timelineRef} />
      )}
      {/* Center column: main chat column. */}
      <div className="chat-main-column flex w-full min-w-0 max-w-[53rem] justify-self-center self-stretch flex-col gap-4">
        {turnError && (
          <p className="alert alert-error" role="alert">
            <span>{t("turnError", { error: turnError.message })}</span>
            {turnError.additionalDetails && <span>{turnError.additionalDetails}</span>}
          </p>
        )}
        {editError && (
          <p className="alert alert-error" role="alert">
            {t("editError", { error: editError.message })}
          </p>
        )}
        <ChatActivityTimeline
          key={threadId}
          connected={events.connected ?? true}
          items={items}
          liveStatus={liveStatus}
          onEdit={canEdit ? handleEdit : undefined}
          onReject={handleReject}
          onResolve={handleResolve}
          pendingRequests={pendingRequests}
          requestSourceLabels={subagentRequestSourceLabels}
          timelineRef={timelineRef}
          turns={turns}
          workingTurnId={workingTurnId}
          workingStartedAt={workingStartedAt}
          completedTurn={completedTurn}
        />
        <div className="sticky bottom-0 z-10 mt-auto shrink-0 bg-base-200 pt-3 pb-2">
          <CurrentGoal threadId={threadId} />
          <QueuedMessages threadId={threadId} />
          <Composer
            threadId={threadId}
            activeTurnId={liveThread?.activeTurnId ?? null}
            model={conversation.data.thread.model}
            reasoningEffort={conversation.data.thread.reasoningEffort}
            pendingUserInputRequests={pendingUserInputRequests}
            onResolveUserInput={handleResolve}
          />
        </div>
      </div>
      {/* Right column: thread summary column; this component is the thread summary panel. */}
      <ThreadSummaryPanel
        gitDiff={gitDiff}
        onReviewGitDiff={() => {
          if (workspacePath) {
            onOpenThreadDiff?.({ threadId, workspace: workspacePath });
          }
        }}
        onOpenTerminal={() =>
          onOpenThreadTerminal?.({
            threadId,
            cwd: workspacePath ?? null,
          })
        }
        onOpenSubagent={onOpenSubagent}
        onOpenWorkspace={
          workspacePath
            ? () => {
                void openPath(workspacePath).catch((error) => {
                  console.error("Unable to open workspace in file manager.", error);
                });
              }
            : undefined
        }
        onOpenEditor={
          workspacePath ? () => openWorkspaceInEditor(workspacePath, getEditorCommandPreference()) : undefined
        }
        tokenUsage={tokenUsage}
        subagents={subagents}
      />
    </div>
  );
}
