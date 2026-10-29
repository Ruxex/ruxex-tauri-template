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
      <ChatSidebarSections
        onClose={onClose}
        selectedThreadId={selectedThreadId}
      />
    </aside>
  );
}
