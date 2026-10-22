import { useState, type ComponentType, type SVGProps } from "react";
import {
  ArchiveBoxIcon,
  CheckIcon,
  DocumentCheckIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  ListBulletIcon,
  PencilSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import {
  useArchiveThread,
  useForkThread,
  useProject,
  useThread,
  useThreadAttachments,
  useThreadGoal,
  useThreadItems,
  useThreadQueue,
  useRenameThread,
} from "../../app-server/hooks";
import { normalizeThreadItem } from "../conversation/conversation-model";
import { ActivityItem } from "../conversation/ActivityItem";
import type { ContextTab } from "../../app/ui-preferences";
import { ProjectContextCard } from "../projects/ProjectContextCard";
import {
  CONTEXT_TABS,
  contextTabLabel,
  filterContextItems,
} from "./context-model";

type ContextTabIcon = ComponentType<SVGProps<SVGSVGElement>>;

const contextTabIcons: Record<ContextTab, ContextTabIcon> = {
  activity: ListBulletIcon,
  changes: DocumentCheckIcon,
  context: InformationCircleIcon,
};

type ContextDrawerProps = {
  threadId?: string;
  projectId?: string;
  activeTab: ContextTab;
  onTabChange: (tab: ContextTab) => void;
  onClose: () => void;
};

export function ContextDrawer({
  threadId,
  projectId,
  activeTab,
  onTabChange,
  onClose,
}: ContextDrawerProps) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const thread = useThread(threadId ?? "");
  const resolvedProjectId = projectId || thread.data?.thread.projectId || "";
  const project = useProject(resolvedProjectId);
  const items = useThreadItems(threadId ?? "", { limit: 100 });
  const goal = useThreadGoal(threadId ?? "");
  const attachments = useThreadAttachments(threadId ?? "", { limit: 100 });
  const queue = useThreadQueue(threadId ?? "", { limit: 100 });
  const rename = useRenameThread();
  const fork = useForkThread();
  const archive = useArchiveThread();

  const threadDetails = thread.data?.thread;
  const filteredItems = filterContextItems(items.data?.data ?? [], activeTab);

  function startRename() {
    setName(threadDetails?.name ?? "");
    setMessage(null);
    setRenaming(true);
  }

  async function saveRename() {
    if (!threadId || !name.trim()) return;
    await rename.mutateAsync({ threadId, name: name.trim() });
    setRenaming(false);
    setMessage("Thread name updated.");
  }

  async function forkThread() {
    if (!threadId) return;
    await fork.mutateAsync({ threadId, excludeTurns: true });
    setMessage("Fork created.");
  }

  async function archiveThread() {
    if (!threadId) return;
    await archive.mutateAsync({ threadId });
    setMessage("Thread archived.");
  }

  return (
    <aside className="context-drawer flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-base-300 bg-base-100">
      <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Workbench
          </p>
          <h2 className="font-semibold">Context</h2>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          aria-label="Close context panel"
          onClick={onClose}
        >
          <XMarkIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div
        className="tabs tabs-boxed m-3 grid grid-cols-3"
        role="tablist"
        aria-label="Context views"
      >
        {CONTEXT_TABS.map((tab) => (
          <button
            className={`tab ${activeTab === tab ? "tab-active" : ""}`}
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
          >
            {(() => {
              const Icon = contextTabIcons[tab];
              return <Icon aria-hidden="true" className="mr-1 size-4" />;
            })()}
            {contextTabLabel(tab)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 pb-4">
        {message && (
          <p className="alert alert-success py-2 text-sm">{message}</p>
        )}
        {activeTab !== "context" && (
          <section className="space-y-3">
            {items.isLoading && (
              <span className="loading loading-spinner loading-sm" />
            )}
            {items.isError && (
              <p className="alert alert-error text-sm">
                Unable to load activity.
              </p>
            )}
            {!items.isLoading && filteredItems.length === 0 && (
              <p className="py-8 text-center text-sm text-base-content/60">
                {activeTab === "changes"
                  ? "No file changes recorded."
                  : "No activity recorded."}
              </p>
            )}
            {filteredItems.map(({ turnId, item }) => (
              <ActivityItem
                item={normalizeThreadItem(turnId, item)}
                key={item.id}
              />
            ))}
          </section>
        )}
        {activeTab === "context" && (
          <section className="space-y-3">
            {project.isError && (
              <p className="alert alert-error text-sm">
                Unable to load project context.
              </p>
            )}
            {project.data?.project && (
              <ProjectContextCard project={project.data.project} />
            )}
            {threadDetails && (
              <section className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                        Thread
                      </p>
                      <h3 className="truncate font-semibold">
                        {threadDetails.name ||
                          threadDetails.preview ||
                          "Untitled chat"}
                      </h3>
                    </div>
                    <span className="badge badge-ghost">
                      {threadDetails.status.type}
                    </span>
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-base-content/60">Model</dt>
                      <dd className="truncate">
                        {threadDetails.model || "Not selected"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-base-content/60">
                        Working directory
                      </dt>
                      <dd className="truncate" title={threadDetails.cwd}>
                        {threadDetails.cwd}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-base-content/60">Attachments</dt>
                      <dd>{attachments.data?.data.length ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-base-content/60">Queued turns</dt>
                      <dd>{queue.data?.data.length ?? "—"}</dd>
                    </div>
                  </dl>
                  {goal.data?.goal && (
                    <div className="rounded-box bg-base-200 p-3 text-sm">
                      <p className="font-medium">
                        Goal · {goal.data.goal.status}
                      </p>
                      <p className="mt-1 text-base-content/70">
                        {goal.data.goal.objective}
                      </p>
                    </div>
                  )}
                  {renaming ? (
                    <div className="join w-full">
                      <input
                        className="input input-bordered join-item min-w-0 flex-1"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-label="Thread name"
                      />
                      <button
                        className="btn join-item"
                        type="button"
                        onClick={() => void saveRename()}
                        disabled={rename.isPending}
                      >
                        <CheckIcon aria-hidden="true" className="size-4" />
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={startRename}
                    >
                      <PencilSquareIcon aria-hidden="true" className="size-4" />
                      Rename thread
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={() => void forkThread()}
                      disabled={fork.isPending}
                    >
                      <DocumentDuplicateIcon
                        aria-hidden="true"
                        className="size-4"
                      />
                      Fork
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      onClick={() => void archiveThread()}
                      disabled={archive.isPending}
                    >
                      <ArchiveBoxIcon aria-hidden="true" className="size-4" />
                      Archive
                    </button>
                  </div>
                </div>
              </section>
            )}
            {!threadDetails && !thread.isLoading && (
              <p className="text-sm text-base-content/60">
                Select a thread to inspect its server-backed context.
              </p>
            )}
          </section>
        )}
      </div>
    </aside>
  );
}
