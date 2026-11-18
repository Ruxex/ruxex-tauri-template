import { useTranslation } from "react-i18next";
import { ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAppServerEvents } from "@/app-server/hooks";
import type { v2 } from "@/protocol";
import { ChatUpdatedAt } from "./ChatListItem";
import { ChatStatusIcon } from "./ChatStatusIcon";
import { ChatTitle } from "./ChatTitle";
import { chatStatusFromThreadStatus } from "./chat-status";

type ChatTableProps = {
  threads: v2.Thread[];
  projectNames?: Map<string, string>;
  onArchive?: (threadId: string) => void;
  isArchiving?: boolean;
};

export function ChatTable({ threads, projectNames, onArchive, isArchiving = false }: ChatTableProps) {
  const { t } = useTranslation("chats");

  const showProject = Boolean(projectNames);
  const showActions = Boolean(onArchive);

  return (
    <section
      aria-label={t("chats")}
      className="overflow-x-auto rounded-xl border border-base-300 bg-base-100"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need to focus this region to scroll the table horizontally.
      tabIndex={0}
    >
      <table className="table min-w-[36rem]">
        <caption className="sr-only">{t("chats")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("chat")}</th>
            {showProject && <th scope="col">{t("project")}</th>}
            <th className="text-right" scope="col">
              {t("updated")}
            </th>
            {showActions && (
              <th className="w-12" scope="col">
                <span className="sr-only">{t("actions")}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {threads.map((thread) => (
            <ChatTableRow
              key={thread.id}
              isArchiving={isArchiving}
              onArchive={onArchive}
              projectName={thread.projectId ? projectNames?.get(thread.projectId) : undefined}
              showProject={showProject}
              thread={thread}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ChatTableRow({
  thread,
  projectName,
  showProject,
  onArchive,
  isArchiving,
}: {
  thread: v2.Thread;
  projectName?: string;
  showProject: boolean;
  onArchive?: (threadId: string) => void;
  isArchiving: boolean;
}) {
  const { t } = useTranslation("chats");

  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const navigate = useNavigate();
  const events = useAppServerEvents();
  const status = chatStatusFromThreadStatus(
    thread.status,
    events.threads[thread.id]?.status,
    Object.values(events.pendingServerRequests).some((request) => request.threadId === thread.id),
  );
  const title = thread.name || thread.preview || t("untitledChat");

  return (
    <tr
      className="group/chat-row cursor-pointer transition-colors hover:bg-base-200/60"
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a, button")) {
          return;
        }
        navigate(`/chat/${thread.id}`);
      }}
    >
      <th className="max-w-[36rem] font-normal" scope="row">
        <Link
          className="block min-w-48 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          to={`/chat/${thread.id}`}
          onMouseEnter={() => setIsTitleHovered(true)}
          onMouseLeave={() => setIsTitleHovered(false)}
        >
          <span className="flex min-w-0 items-center gap-2 font-semibold">
            {status && <ChatStatusIcon status={status} />}
            <ChatTitle isHovered={isTitleHovered} title={title} />
          </span>
          {thread.preview && thread.preview !== title && (
            <span className="mt-1 block truncate text-sm font-normal text-base-content/70">{thread.preview}</span>
          )}
        </Link>
      </th>
      {showProject && (
        <td className="max-w-64">
          <span className="block truncate text-sm text-base-content/70">{projectName ?? "—"}</span>
        </td>
      )}
      <td className="whitespace-nowrap text-right text-sm text-base-content/70">
        <ChatUpdatedAt timestamp={thread.updatedAt} />
      </td>
      {onArchive && (
        <td className="w-12 text-right">
          <button
            aria-label={t("archiveChat", { title })}
            className="btn btn-ghost btn-xs btn-square opacity-0 transition-opacity group-hover/chat-row:opacity-100 focus-visible:opacity-100"
            disabled={isArchiving}
            title={t("archiveChat", { title })}
            type="button"
            onClick={() => onArchive(thread.id)}
          >
            <ArchiveBoxIcon aria-hidden="true" className="size-4" />
          </button>
        </td>
      )}
    </tr>
  );
}
