import { useTranslation } from "react-i18next";
import {
  ChevronRightIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAllProjectList } from "../../app-server/hooks";
import { EmptyState } from "../common/AsyncState";
import { ThreadList } from "../sidebar/ThreadList";
import { ChatSearchBox } from "./ChatSearchBox";

export function ChatSidebarSections({
  onClose,
  selectedThreadId,
}: {
  onClose: () => void;
  selectedThreadId?: string;
}) {
  const { t } = useTranslation("chats");

  const [projectSearch, setProjectSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<
    Record<string, boolean>
  >({});
  const projects = useAllProjectList({
    limit: 100,
    sortKey: "position",
    sortDirection: "asc",
  });
  const allProjects = projects.data?.data ?? [];
  const normalizedProjectSearch = projectSearch.trim().toLocaleLowerCase();
  const visibleProjects = normalizedProjectSearch
    ? allProjects.filter((project) =>
        project.name.toLocaleLowerCase().includes(normalizedProjectSearch),
      )
    : allProjects;

  return (
    <nav
      aria-label={t("chatNavigation")}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Link className="btn btn-outline btn-sm mb-5 w-full" to="/">
        <PlusIcon aria-hidden="true" className="size-4" />
        {t("newChat")}
      </Link>
      <ChatSearchBox onSelect={() => onClose()} />

      <div className="-mr-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-4">
        <details className="group rounded-box" open>
          <summary
            aria-controls="recent-chats-list"
            className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/75 hover:bg-base-200"
            id="recent-chats-heading"
          >
            <span>{t("recentChats")}</span>
            <ChevronRightIcon
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="pl-1" id="recent-chats-list">
            <ThreadList selectedThreadId={selectedThreadId} />
          </div>
        </details>

        <details className="group rounded-box" open>
          <summary
            aria-controls="projects-list"
            className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/75 hover:bg-base-200"
            id="projects-heading"
          >
            <span>{t("projects")}</span>
            <ChevronRightIcon
              aria-hidden="true"
              className="ml-auto size-4 shrink-0 transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="w-full" id="projects-list">
            {allProjects.length > 8 && (
              <search className="mb-2 block">
                <label className="input input-bordered input-sm mx-2 flex w-[calc(100%-1rem)] items-center gap-2">
                  <MagnifyingGlassIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  <span className="sr-only">{t("filterProjects")}</span>
                  <input
                    className="min-w-0 grow bg-transparent"
                    onChange={(event) => setProjectSearch(event.target.value)}
                    placeholder={t("filterProjects")}
                    type="search"
                    value={projectSearch}
                  />
                </label>
              </search>
            )}
            {projects.isLoading && (
              <span
                className="mx-3 inline-flex items-center gap-2"
                role="status"
              >
                <span
                  aria-hidden="true"
                  className="loading loading-spinner loading-sm"
                />
                <span className="sr-only">{t("loadingProjects")}</span>
              </span>
            )}
            {projects.isError && (
              <div
                aria-busy={projects.isFetching}
                className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-error"
                role="alert"
              >
                {t("unableToLoadProjects")}
                <button
                  className="btn btn-ghost btn-xs"
                  disabled={projects.isFetching}
                  onClick={() => void projects.refetch()}
                  type="button"
                >
                  {projects.isFetching ? t("retrying") : t("retry")}
                </button>
              </div>
            )}
            {visibleProjects.length > 0 && (
              <ul className="w-full space-y-1">
                {visibleProjects.map((project) => (
                  <li className="min-w-0" key={project.id}>
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2rem] items-center gap-1">
                      <button
                        aria-controls={`project-chats-${project.id}`}
                        aria-expanded={Boolean(expandedProjects[project.id])}
                        aria-label={t(
                          expandedProjects[project.id]
                            ? "collapseProject"
                            : "expandProject",
                          { name: project.name },
                        )}
                        className="btn btn-ghost btn-sm w-full justify-start gap-2 truncate px-3"
                        type="button"
                        onClick={() =>
                          setExpandedProjects((current) => ({
                            ...current,
                            [project.id]: !current[project.id],
                          }))
                        }
                      >
                        <ChevronRightIcon
                          aria-hidden="true"
                          className={`size-4 shrink-0 transition-transform ${expandedProjects[project.id] ? "rotate-90" : ""}`}
                        />
                        <FolderIcon
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                        <span className="min-w-0 truncate">{project.name}</span>
                      </button>
                      <Link
                        aria-label={t("newChatInProject", {
                          name: project.name,
                        })}
                        className="btn btn-ghost btn-sm btn-square size-8 shrink-0"
                        title={t("newChatInProject", { name: project.name })}
                        to={`/?projectId=${encodeURIComponent(project.id)}`}
                      >
                        <PencilSquareIcon
                          aria-hidden="true"
                          className="size-4"
                        />
                      </Link>
                    </div>
                    {expandedProjects[project.id] && (
                      <div className="pl-8" id={`project-chats-${project.id}`}>
                        <ThreadList
                          onSelect={onClose}
                          projectId={project.id}
                          selectedThreadId={selectedThreadId}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!projects.isLoading &&
              allProjects.length > 0 &&
              !visibleProjects.length && (
                <p className="px-3 py-2 text-xs text-base-content/60">
                  {t("noProjectsMatchThisFilter")}
                </p>
              )}
            {!projects.isLoading &&
              !projects.isError &&
              !allProjects.length && (
                <div className="px-1">
                  <EmptyState
                    action={
                      <Link className="btn btn-ghost btn-xs" to="/projects">
                        {t("openProjects")}
                      </Link>
                    }
                    compact
                    description={t(
                      "createAProjectToOrganizeChatsAndWorkspaces",
                    )}
                    icon={FolderIcon}
                    title={t("noProjectsYet")}
                  />
                </div>
              )}
          </div>
        </details>
      </div>
    </nav>
  );
}
