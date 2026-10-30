import { ClipboardDocumentIcon, PencilIcon } from "@heroicons/react/24/outline";
import { type FormEvent, memo, useState } from "react";

import {
  areConversationViewItemsEqual,
  type ConversationViewItem,
} from "./conversation-model";
import { MarkdownContent } from "./MarkdownContent";

type ConversationItemProps = {
  item: ConversationViewItem;
  onEdit?: (
    item: ConversationViewItem,
    editedText: string,
  ) => void | Promise<void>;
};

export const ConversationItem = memo(function ConversationItem({
  item,
  onEdit,
}: ConversationItemProps) {
  const isUser = item.type === "userMessage";
  const canEdit =
    isUser &&
    item.editable !== false &&
    item.text.trim().length > 0 &&
    Boolean(onEdit);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  function beginEditing() {
    setDraft(item.text);
    setIsEditing(true);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard?.writeText(item.text);
      setCopied(true);
    } catch {
      // Clipboard access can be unavailable outside a secure browser context.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editedText = draft.trim();
    if (!canEdit || !onEdit || !editedText || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onEdit(item, editedText);
      setIsEditing(false);
    } catch {
      // The parent renders the mutation error while keeping the edit form open.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <article className={`group chat ${isUser ? "chat-end" : "chat-start"}`}>
      {isEditing ? (
        <form
          className="w-full max-w-3xl rounded-box border border-primary bg-base-100 p-3 shadow-sm"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <textarea
            aria-label="Edit message"
            className="textarea textarea-bordered min-h-28 w-full resize-y"
            disabled={isSubmitting}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              className="btn btn-ghost btn-sm"
              disabled={isSubmitting}
              onClick={() => setIsEditing(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={isSubmitting || !draft.trim()}
              type="submit"
            >
              {isSubmitting ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      ) : (
        <div
          className={`rounded-box border border-base-300 ${isUser ? "px-3 py-2" : "px-4 py-3"} ${isUser ? "bg-primary text-primary-content" : "bg-base-100"}`}
        >
          <MarkdownContent text={item.text || "…"} />
        </div>
      )}
      {isUser && (
        <fieldset
          aria-label="Message actions"
          className="chat-footer m-0 mt-1 flex min-h-7 items-center justify-end gap-1 border-0 p-0 text-xs text-base-content/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {!isEditing && (
            <>
              {item.timestamp != null && (
                <time
                  dateTime={new Date(item.timestamp * 1000).toISOString()}
                  title={formatTimestamp(item.timestamp)}
                >
                  {formatTimestamp(item.timestamp)}
                </time>
              )}
              <button
                aria-label={copied ? "Copied message" : "Copy message"}
                className="btn btn-ghost btn-xs"
                onClick={() => void handleCopy()}
                title={copied ? "Copied" : "Copy"}
                type="button"
              >
                <ClipboardDocumentIcon aria-hidden="true" className="size-4" />
              </button>
              {canEdit && (
                <button
                  aria-label="Edit message"
                  className="btn btn-ghost btn-xs"
                  onClick={beginEditing}
                  title="Edit"
                  type="button"
                >
                  <PencilIcon aria-hidden="true" className="size-4" />
                </button>
              )}
            </>
          )}
        </fieldset>
      )}
    </article>
  );
}, areConversationItemPropsEqual);

function areConversationItemPropsEqual(
  left: ConversationItemProps,
  right: ConversationItemProps,
): boolean {
  return (
    left.onEdit === right.onEdit &&
    areConversationViewItemsEqual(left.item, right.item)
  );
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}
