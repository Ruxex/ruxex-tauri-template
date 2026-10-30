type ProjectOption = {
  id: string;
  name: string;
};

type ProjectSelectorProps = {
  projects: ProjectOption[];
  value: string;
  isLoading: boolean;
  isError: boolean;
  disabled?: boolean;
  onChange: (projectId: string) => void;
};

export function ProjectSelector({
  projects,
  value,
  isLoading,
  isError,
  disabled = false,
  onChange,
}: ProjectSelectorProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <select
        aria-label="Project"
        className="select select-bordered select-sm h-8 min-h-8 w-48 max-w-full text-xs"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">No project</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      {isLoading && (
        <span className="mt-1 text-xs text-base-content/60">
          Loading projects…
        </span>
      )}
      {isError && (
        <span className="mt-1 text-xs text-error">
          Unable to load projects.
        </span>
      )}
    </div>
  );
}
