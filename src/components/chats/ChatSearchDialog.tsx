import { useEffect, useRef, useState } from "react";
import { useThreadSearch } from "../../app-server/hooks";
import { formatErrorMessage } from "../../app/error-message";
import { ChatListItem } from "./ChatListItem";

type ChatSearchDialogProps = {
  onClose: () => void;
  onSelect: (threadId: string) => void;
};

export function ChatSearchDialog({ onClose, onSelect }: ChatSearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useThreadSearch(searchTerm);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const rows = results.data?.data ?? [];

  return (
    <section
      aria-label="Chat search"
      className="mb-4 rounded-box border border-base-300 bg-base-200 p-3"
      role="dialog"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Search chats</h3>
        <button
          className="btn btn-ghost btn-xs"
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
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
    </section>
  );
}
