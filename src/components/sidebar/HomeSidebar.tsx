import { useTranslation } from "react-i18next";
import { ChatSidebarSections } from "../chats/ChatSidebarSections";

export function HomeSidebar({
  onClose,
  selectedThreadId,
}: {
  onClose: () => void;
  selectedThreadId?: string;
}) {
  const { t } = useTranslation("navigation");
  return (
    <aside
      aria-label={t("navigation:chatSidebar")}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-base-100 p-4"
    >
      <ChatSidebarSections
        onClose={onClose}
        selectedThreadId={selectedThreadId}
      />
    </aside>
  );
}
