import {
  CheckIcon,
  ChevronDownIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { useCloseDropdownOnOutsidePointerDown } from "../conversation/useCloseDropdown";
import { ProjectIcon } from "../projects/ProjectIcon";
import {
  parseProjectMetadata,
  projectColorClassName,
} from "../projects/project-metadata";

type ProjectOption = {
  id: string;
  name: string;
  metadata?: unknown;
};

type ProjectSelectorProps = {
  projects: ProjectOption[];
  value: string;
  isLoading: boolean;
  isError: boolean;
  disabled?: boolean;
  onChange: (projectId: string) => void;
  onCreateProject?: () => void;
};

export function ProjectSelector({
  projects,
  value,
  isLoading,
  isError,
  disabled = false,
  onChange,
  onCreateProject,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const detailsRef = useCloseDropdownOnOutsidePointerDown();
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(normalizedQuery),
  );
  const optionsCount = visibleProjects.length + 1;
  const selectedProject = projects.find((project) => project.id === value);
  const activeOption =
    activeIndex < visibleProjects.length
      ? `${listId}-project-${visibleProjects[activeIndex]?.id}`
      : `${listId}-no-project`;

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    } else {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex]);

  function close() {
    detailsRef.current?.removeAttribute("open");
    setOpen(false);
  }

  function chooseProject(projectId: string) {
    if (disabled) {
      return;
    }
    onChange(projectId);
    close();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) => (current + direction + optionsCount) % optionsCount,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      chooseProject(
        activeIndex < visibleProjects.length
          ? (visibleProjects[activeIndex]?.id ?? "")
          : "",
      );
    }
  }

  function projectOptionProps(project: ProjectOption, index: number) {
    const active = index === activeIndex;
    return {
      "aria-selected": project.id === value,
      className: `flex min-h-10 w-full items-center gap-2 rounded-btn px-3 py-2 text-left text-sm ${active ? "bg-primary/15 font-semibold text-base-content" : "hover:bg-base-200"}`,
      "data-active": active ? "true" : undefined,
      onMouseEnter: () => setActiveIndex(index),
      ref: (element: HTMLButtonElement | null) => {
        optionRefs.current[index] = element;
      },
      role: "option" as const,
      tabIndex: -1,
      type: "button" as const,
    };
  }

  const noProjectActive = activeIndex === visibleProjects.length;

  return (
    <details
      className="dropdown dropdown-top w-[min(20rem,calc(100vw-2rem))]"
      onToggle={(event) => {
        if (disabled && event.currentTarget.open) {
          event.currentTarget.open = false;
          return;
        }
        setOpen(event.currentTarget.open);
      }}
      ref={detailsRef}
    >
      <summary
        aria-disabled={disabled}
        aria-label="Project"
        className={`btn btn-ghost btn-sm h-9 min-h-9 w-full justify-between gap-2 px-2 text-sm ${disabled ? "opacity-60" : ""}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedProject ? (
            <ProjectGlyph project={selectedProject} />
          ) : (
            <FolderIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-base-content/60"
            />
          )}
          <span className="truncate">
            {selectedProject?.name ?? "No project"}
          </span>
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
      </summary>
      <div className="dropdown-content z-30 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
        <label className="input input-bordered input-sm flex h-9 min-h-9 items-center gap-2">
          <MagnifyingGlassIcon
            aria-hidden="true"
            className="size-4 text-base-content/50"
          />
          <input
            aria-activedescendant={activeOption}
            aria-controls={listId}
            aria-label="Search projects"
            aria-expanded={open}
            className="grow text-sm"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search projects"
            ref={searchRef}
            role="combobox"
            type="search"
            value={query}
          />
        </label>

        <div aria-label="Projects" className="mt-2" id={listId} role="listbox">
          <div className="max-h-52 overflow-y-auto">
            {isLoading && (
              <p
                className="px-3 py-2 text-sm text-base-content/60"
                role="status"
              >
                Loading projects…
              </p>
            )}
            {isError && (
              <p className="px-3 py-2 text-sm text-error" role="alert">
                Unable to load projects.
              </p>
            )}
            {!isLoading && !isError && visibleProjects.length > 0 && (
              <ul className="menu menu-vertical w-full gap-0.5 p-0">
                {visibleProjects.map((project, index) => (
                  <li key={project.id}>
                    <button
                      {...projectOptionProps(project, index)}
                      id={`${listId}-project-${project.id}`}
                      onClick={() => chooseProject(project.id)}
                    >
                      <ProjectGlyph project={project} />
                      <span className="min-w-0 flex-1 truncate">
                        {project.name}
                      </span>
                      {project.id === value && (
                        <CheckIcon
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!isLoading && !isError && visibleProjects.length === 0 && (
              <p className="px-3 py-2 text-sm text-base-content/60">
                {projects.length ? "No matching projects." : "No projects yet."}
              </p>
            )}
          </div>
          <button
            aria-selected={!value}
            className={`mt-1 flex min-h-10 w-full items-center gap-2 rounded-btn px-3 py-2 text-left text-sm ${noProjectActive ? "bg-primary/15 font-semibold text-base-content" : "hover:bg-base-200"}`}
            data-active={noProjectActive ? "true" : undefined}
            id={`${listId}-no-project`}
            onClick={() => chooseProject("")}
            onMouseEnter={() => setActiveIndex(visibleProjects.length)}
            ref={(element) => {
              optionRefs.current[visibleProjects.length] = element;
            }}
            role="option"
            tabIndex={-1}
            type="button"
          >
            <span className="min-w-0 flex-1">No project</span>
            {!value && (
              <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
            )}
          </button>
        </div>

        {onCreateProject && (
          <div className="mt-2 border-t border-base-300 pt-2">
            <button
              className="btn btn-ghost btn-sm w-full justify-start"
              disabled={disabled}
              onClick={() => {
                close();
                onCreateProject();
              }}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              Create project
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

function ProjectGlyph({ project }: { project: ProjectOption }) {
  const metadata = parseProjectMetadata(project.metadata);

  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center rounded-md ${projectColorClassName(metadata.color)}`}
    >
      <ProjectIcon className="size-4" icon={metadata.icon} />
    </span>
  );
}
