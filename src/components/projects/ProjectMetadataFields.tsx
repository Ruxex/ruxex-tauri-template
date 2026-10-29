import type { ProjectMetadata } from "./project-metadata";
import { PROJECT_COLOR_OPTIONS, PROJECT_ICON_OPTIONS } from "./project-metadata";
import { ProjectIcon } from "./ProjectIcon";

type ProjectMetadataFieldsProps = {
  value: ProjectMetadata;
  onChange: (value: ProjectMetadata) => void;
};

export function ProjectMetadataFields({
  value,
  onChange,
}: ProjectMetadataFieldsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <fieldset aria-label="Project icon" className="grid grid-cols-4 gap-2">
        {PROJECT_ICON_OPTIONS.map((option) => {
          const selected = value.icon === option.value;
          return (
            <button
              aria-label={option.label}
              aria-pressed={selected}
              className={`btn btn-square ${selected ? "btn-primary" : "btn-ghost"}`}
              key={option.value}
              title={option.label}
              type="button"
              onClick={() => onChange({ ...value, icon: option.value })}
            >
              <ProjectIcon aria-hidden="true" className="size-5" icon={option.value} />
            </button>
          );
        })}
      </fieldset>
      <label className="form-control w-full">
        <span className="label-text text-sm font-medium">Color</span>
        <select
          aria-label="Project color"
          className="select select-bordered min-h-11 w-full"
          value={value.color}
          onChange={(event) =>
            onChange({ ...value, color: event.target.value as ProjectMetadata["color"] })
          }
        >
          {PROJECT_COLOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
