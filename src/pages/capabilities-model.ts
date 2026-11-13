import type { v2 } from "../protocol";

export function groupPluginsByCategory<
  T extends { interface: { category: string | null } | null },
>(plugins: T[]) {
  const groups = new Map<string, T[]>();
  for (const plugin of plugins) {
    const category = plugin.interface?.category ?? "Uncategorized";
    const group = groups.get(category);
    if (group) {
      group.push(plugin);
    } else {
      groups.set(category, [plugin]);
    }
  }
  return [...groups].map(([category, groupedPlugins]) => ({
    category,
    plugins: groupedPlugins,
  }));
}

export function pluginDetailsPath(
  marketplaceName: string,
  pluginName: string,
): string {
  return `/capabilities/plugins/${encodeURIComponent(marketplaceName)}/${encodeURIComponent(pluginName)}`;
}

const SKILL_DESCRIPTION_MAX_LENGTH = 160;

export function skillGroupLabel(entry: v2.SkillsListEntry): string {
  return entry.skills.length > 0 &&
    entry.skills.every((skill) => skill.scope === "system")
    ? "Default"
    : entry.cwd;
}

export function skillDescription(skill: v2.SkillMetadata): {
  text: string;
  fullText: string;
} | null {
  const fullText =
    skill.interface?.shortDescription?.trim() ||
    skill.shortDescription?.trim() ||
    skill.description?.trim();
  if (!fullText) return null;

  return {
    fullText,
    text:
      fullText.length > SKILL_DESCRIPTION_MAX_LENGTH
        ? `${fullText.slice(0, SKILL_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`
        : fullText,
  };
}
