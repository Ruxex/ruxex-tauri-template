export const PROJECT_ICON_OPTIONS = [
  { value: "folder", label: "Folder" },
  { value: "code", label: "Code" },
  { value: "globe", label: "Website" },
  { value: "book", label: "Documentation" },
  { value: "cube", label: "Package" },
  { value: "briefcase", label: "Briefcase" },
  { value: "calendar", label: "Calendar" },
  { value: "chart", label: "Chart" },
  { value: "chat", label: "Chat" },
  { value: "cloud", label: "Cloud" },
  { value: "document", label: "Document" },
  { value: "heart", label: "Health" },
  { value: "home", label: "Home" },
  { value: "rocket", label: "Rocket" },
  { value: "star", label: "Star" },
  { value: "wrench", label: "Tools" },
] as const;

export const PROJECT_COLOR_OPTIONS = [
  { value: "blue", label: "Blue" },
  { value: "indigo", label: "Indigo" },
  { value: "violet", label: "Violet" },
  { value: "fuchsia", label: "Fuchsia" },
  { value: "pink", label: "Pink" },
  { value: "red", label: "Red" },
  { value: "rose", label: "Rose" },
  { value: "orange", label: "Orange" },
  { value: "amber", label: "Amber" },
  { value: "yellow", label: "Yellow" },
  { value: "lime", label: "Lime" },
  { value: "green", label: "Green" },
  { value: "emerald", label: "Emerald" },
  { value: "teal", label: "Teal" },
  { value: "cyan", label: "Cyan" },
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
    typeof value === "string" &&
    options.some((option) => option.value === value)
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
    blue: "project-icon-tile project-icon-blue",
    indigo: "project-icon-tile project-icon-indigo",
    violet: "project-icon-tile project-icon-violet",
    fuchsia: "project-icon-tile project-icon-fuchsia",
    pink: "project-icon-tile project-icon-pink",
    red: "project-icon-tile project-icon-red",
    rose: "project-icon-tile project-icon-rose",
    orange: "project-icon-tile project-icon-orange",
    amber: "project-icon-tile project-icon-amber",
    yellow: "project-icon-tile project-icon-yellow",
    lime: "project-icon-tile project-icon-lime",
    green: "project-icon-tile project-icon-green",
    emerald: "project-icon-tile project-icon-emerald",
    teal: "project-icon-tile project-icon-teal",
    cyan: "project-icon-tile project-icon-cyan",
    slate: "project-icon-tile project-icon-slate",
  };
  return classes[color] ?? classes[DEFAULT_PROJECT_METADATA.color];
}
