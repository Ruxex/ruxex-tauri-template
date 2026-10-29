import type { ConversationViewItem } from "./conversation-model";
import { MarkdownContent } from "./MarkdownContent";

type ConversationItemProps = {
  item: ConversationViewItem;
};

export function ConversationItem({ item }: ConversationItemProps) {
  const isUser = item.type === "userMessage";
  return (
    <article className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
      <div className="chat-header mb-1 text-xs text-base-content/60">
        {item.title}
      </div>
      <div
        className={`rounded-box border border-base-300 px-4 py-3 ${isUser ? "bg-primary text-primary-content" : "bg-base-100"}`}
      >
        <MarkdownContent text={item.text || "…"} />
      </div>
    </article>
  );
}
