import { XMarkIcon } from "@heroicons/react/24/outline";

import { ChatSidebarSections } from "../chats/ChatSidebarSections";

export function HomeSidebar({
  onClose,
  selectedThreadId,
}: {
  onClose: () => void;
  selectedThreadId?: string;
}) {
  return (
    <aside
      aria-label="Chat sidebar"
      className="flex h-full min-h-0 w-72 flex-col bg-base-100 p-4"
    >
      <div className="mb-3 flex shrink-0 justify-end">
        <button
          aria-label="Close sidebar panel"
          className="btn btn-ghost btn-sm btn-square"
          type="button"
          onClick={onClose}
        >
          <XMarkIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <ChatSidebarSections
        onClose={onClose}
        selectedThreadId={selectedThreadId}
      />
    </aside>
  );
}
