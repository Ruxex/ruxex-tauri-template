export const PROJECT_ICON_OPTIONS = [
  { value: "folder", label: "Folder" },
  { value: "code", label: "Code" },
  { value: "globe", label: "Website" },
  { value: "book", label: "Documentation" },
  { value: "cube", label: "Package" },
] as const;

export const PROJECT_COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "violet", label: "Violet" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "rose", label: "Rose" },
  { value: "slate", label: "Slate" },
] as const;

export type ProjectIcon = (typeof PROJECT_ICON_OPTIONS)[number]["value"];
export type ProjectColor = (typeof PROJECT_COLOR_OPTIONS)[number]["value"];

export type ProjectMetadata = {
  icon: ProjectIcon;
  color: ProjectColor;
};

export const DEFAULT_PROJECT_METADATA: ProjectMetadata = {
  icon: "folder",
  color: "blue",
};

function isAllowedValue<T extends string>(
  value: unknown,
  options: readonly { value: T }[],
): value is T {
  return (
    typeof value === "string" && options.some((option) => option.value === value)
  );
}

export function parseProjectMetadata(metadata: unknown): ProjectMetadata {
  const source =
    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)
      : {};

  return {
    icon: isAllowedValue(source.icon, PROJECT_ICON_OPTIONS)
      ? source.icon
      : DEFAULT_PROJECT_METADATA.icon,
    color: isAllowedValue(source.color, PROJECT_COLOR_OPTIONS)
      ? source.color
      : DEFAULT_PROJECT_METADATA.color,
  };
}

export function projectMetadataToRecord(
  metadata: ProjectMetadata,
  existingMetadata?: Record<string, string | undefined> | null,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(existingMetadata ?? {})) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }

  delete result.type;
  result.icon = metadata.icon;
  result.color = metadata.color;
  return result;
}

export function projectColorClassName(color: ProjectColor): string {
  const classes: Record<ProjectColor, string> = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    green: "bg-green-500/10 text-green-600 dark:text-green-300",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  };
  return classes[color] ?? classes[DEFAULT_PROJECT_METADATA.color];
}
