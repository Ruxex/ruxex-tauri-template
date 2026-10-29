import type { ConversationViewItem } from "./conversation-model";
import { MarkdownContent } from "./MarkdownContent";
import { PencilIcon } from "@heroicons/react/24/outline";

type ConversationItemProps = {
  item: ConversationViewItem;
  onEdit?: (item: ConversationViewItem) => void;
};

export function ConversationItem({ item, onEdit }: ConversationItemProps) {
  const isUser = item.type === "userMessage";
  const canEdit =
    isUser && item.editable !== false && item.text.trim().length > 0 && onEdit;
  return (
    <article className={`chat ${isUser ? "chat-end" : "chat-start"}`}>
      <div
        className={`rounded-box border border-base-300 px-4 py-3 ${isUser ? "bg-primary text-primary-content" : "bg-base-100"}`}
      >
        <MarkdownContent text={item.text || "…"} />
        {canEdit && (
          <button
            aria-label="Edit message"
            className="btn btn-ghost btn-xs mt-2"
            type="button"
            onClick={() => onEdit(item)}
          >
            <PencilIcon aria-hidden="true" className="size-3.5" />
            Edit
          </button>
        )}
      </div>
    </article>
  );
}
