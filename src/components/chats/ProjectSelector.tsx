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
    <label className="form-control">
      <span className="label-text font-medium">Project</span>
      <select
        aria-label="Project"
        className="select select-bordered mt-2 min-h-11"
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
        <span className="mt-1 text-xs text-error">Unable to load projects.</span>
      )}
    </label>
  );
}
