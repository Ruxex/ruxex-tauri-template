import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { useThreadConversation } from "../../app-server/hooks";
import { ConversationItem } from "../conversation/ConversationItem";
import { normalizeThreadItem } from "../conversation/conversation-model";

type SubagentDetailProps = {
  threadId: string;
  onBack: () => void;
};

export function SubagentDetail({ threadId, onBack }: SubagentDetailProps) {
  const conversation = useThreadConversation(threadId);

  return (
    <section aria-label="Subagent detail" className="space-y-4">
      <button
        aria-label="Back to subagents"
        className="btn btn-ghost btn-sm"
        onClick={onBack}
        type="button"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Back
      </button>
      {conversation.isLoading || conversation.isPending ? (
        <p className="text-sm text-base-content/60">Loading subagent…</p>
      ) : conversation.isError || !conversation.data ? (
        <p className="alert alert-error" role="alert">
          Unable to load this subagent.
        </p>
      ) : (
        <>
          <h3 className="text-lg font-semibold">
            {conversation.data.thread.name ??
              conversation.data.thread.agentNickname ??
              "Subagent"}
          </h3>
          <div className="space-y-3">
            {conversation.data.items.data.map(({ turnId, item }) => (
              <ConversationItem
                item={normalizeThreadItem(turnId, item)}
                key={`${turnId}:${item.id}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
