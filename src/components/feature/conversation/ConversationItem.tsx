import { i18n } from "@/app/i18n";
import { dateTimeFormatter } from "@/app/locale-format";
import { useTranslation } from "react-i18next";
import { ClipboardDocumentIcon, PencilIcon } from "@heroicons/react/24/outline";
import { type FormEvent, memo, useState } from "react";

import { areConversationViewItemsEqual, type ConversationViewItem } from "./conversation-model";
import { MessageContent } from "./MessageContent";

type ConversationItemProps = {
  isStreaming?: boolean;
  item: ConversationViewItem;
  onEdit?: (item: ConversationViewItem, editedText: string) => void | Promise<void>;
};

export const ConversationItem = memo(function ConversationItem({
  isStreaming = false,
  item,
  onEdit,
}: ConversationItemProps) {
  const { t } = useTranslation("conversation");

  const isUser = item.type === "userMessage";
  const canEdit = isUser && item.editable !== false && item.text.trim().length > 0 && Boolean(onEdit);
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
    <article
      className={`group chat min-w-0 ${isUser ? "chat-end mt-2 w-fit max-w-full ms-auto" : "chat-start w-full"}`}
      data-conversation-item-id={item.id}
    >
      {isEditing ? (
        <form
          className="w-full max-w-3xl rounded-box border border-primary bg-base-100 p-3 shadow-sm"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <textarea
            aria-label={t("editMessage")}
            className="textarea textarea-bordered min-h-28 w-full resize-y"
            disabled={isSubmitting}
            onChange={(event) => setDraft(event.target.value)}
            value={draft}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              aria-label={t("cancel")}
              className="btn btn-ghost btn-sm"
              disabled={isSubmitting}
              onClick={() => setIsEditing(false)}
              type="button"
            >
              {t("cancel")}
            </button>
            <button
              aria-label={isSubmitting ? t("sending") : t("send")}
              className="btn btn-primary btn-sm"
              disabled={isSubmitting || !draft.trim()}
              type="submit"
            >
              {isSubmitting ? t("sending") : t("send")}
            </button>
          </div>
        </form>
      ) : (
        <div
          className={
            isUser
              ? "rounded-box border border-base-300 bg-base-200 px-3 py-1.5 text-base-content"
              : "col-start-2 min-w-0 w-full border-0 bg-transparent px-0 py-2"
          }
        >
          <MessageContent isAnimating={isStreaming} text={item.text || "…"} />
        </div>
      )}
      {isUser && (
        <fieldset
          aria-label={t("messageActions")}
          className="chat-footer m-0 mt-1 flex min-h-7 items-center justify-end gap-1 border-0 p-0 text-xs text-base-content/60 opacity-0 transition-opacity group-hover:opacity-100"
        >
          {!isEditing && (
            <>
              {item.timestamp != null && (
                <time dateTime={new Date(item.timestamp * 1000).toISOString()} title={formatTimestamp(item.timestamp)}>
                  {formatTimestamp(item.timestamp)}
                </time>
              )}
              <button
                aria-label={copied ? t("copiedMessage") : t("copyMessage")}
                className="btn btn-ghost btn-xs"
                onClick={() => void handleCopy()}
                title={copied ? t("copied") : t("copy")}
                type="button"
              >
                <ClipboardDocumentIcon aria-hidden="true" className="size-4" />
              </button>
              {canEdit && (
                <button
                  aria-label={t("editMessage")}
                  className="btn btn-ghost btn-xs"
                  onClick={beginEditing}
                  title={t("edit")}
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

function areConversationItemPropsEqual(left: ConversationItemProps, right: ConversationItemProps): boolean {
  return (
    left.onEdit === right.onEdit &&
    left.isStreaming === right.isStreaming &&
    areConversationViewItemsEqual(left.item, right.item)
  );
}

function formatTimestamp(timestamp: number): string {
  return dateTimeFormatter(i18n.resolvedLanguage === "ja" ? "ja" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp * 1000));
}
