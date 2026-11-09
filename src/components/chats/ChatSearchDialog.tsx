import { useEffect, useRef, useState } from "react";
import { useThreadSearch } from "../../app-server/hooks";
import { formatErrorMessage } from "../../app/error-message";
import { DialogShell } from "../common/DialogShell";
import { ChatListItem } from "./ChatListItem";

type ChatSearchDialogProps = {
  initialSearchTerm?: string;
  onClose: () => void;
  onSelect: (threadId: string) => void;
  open?: boolean;
};

export function ChatSearchDialog({
  initialSearchTerm = "",
  onClose,
  onSelect,
  open = true,
}: ChatSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useThreadSearch(searchTerm);

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const rows = results.data?.data ?? [];

  return (
    <DialogShell
      closeLabel="Close chat search"
      onClose={onClose}
      open={open}
      title="Search chats"
      titleId="chat-search-title"
    >
      <input
        ref={inputRef}
        aria-label="Search chats"
        className="input input-bordered input-sm mt-2 w-full"
        placeholder="Search chat titles and messages"
        type="search"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
      />
      <div className="mt-3">
        {results.isLoading && (
          <span className="loading loading-spinner loading-sm" />
        )}
        {results.isError && (
          <p className="text-xs text-error">
            {formatErrorMessage(results.error)}
          </p>
        )}
        {searchTerm.trim() &&
          !results.isLoading &&
          !results.isError &&
          !rows.length && (
            <p className="text-xs text-base-content/60">No matching chats.</p>
          )}
        {rows.length > 0 && (
          <ul className="menu w-full gap-1 p-0">
            {rows.map(({ thread }) => (
              <li key={thread.id}>
                <ChatListItem
                  showPreview
                  thread={thread}
                  onClick={() => onSelect(thread.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </DialogShell>
  );
}
