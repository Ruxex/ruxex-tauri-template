import type { ProjectMetadata } from "./project-metadata";
import { PROJECT_COLOR_OPTIONS, PROJECT_ICON_OPTIONS } from "./project-metadata";

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
      <label className="form-control w-full">
        <span className="label-text text-sm font-medium">Icon</span>
        <select
          aria-label="Project icon"
          className="select select-bordered min-h-11 w-full"
          value={value.icon}
          onChange={(event) =>
            onChange({ ...value, icon: event.target.value as ProjectMetadata["icon"] })
          }
        >
          {PROJECT_ICON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
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
