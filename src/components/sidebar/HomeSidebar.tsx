import { TaskSidebarSections } from "../tasks/TaskSidebarSections";
import { SidebarHeader } from "./SidebarHeader";

export function HomeSidebar({
  onClose,
  selectedThreadId,
}: {
  onClose: () => void;
  selectedThreadId?: string;
}) {
  return (
    <aside
      aria-label="Home sidebar"
      className="flex h-full min-h-0 w-72 flex-col bg-base-100 p-4"
    >
      <SidebarHeader label="Home" onClose={onClose} />
      <TaskSidebarSections
        onClose={onClose}
        selectedThreadId={selectedThreadId}
      />
    </aside>
  );
}
