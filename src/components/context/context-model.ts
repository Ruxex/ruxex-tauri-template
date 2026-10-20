import type { ContextTab } from "../../app/ui-preferences";

export const CONTEXT_TABS = ["activity", "changes", "context"] as const satisfies readonly ContextTab[];

export function contextTabLabel(tab: ContextTab): string {
  return tab[0].toUpperCase() + tab.slice(1);
}

export function isContextTab(value: string): value is ContextTab {
  return CONTEXT_TABS.includes(value as ContextTab);
}

export function filterContextItems<T extends { item: { type: string } }>(
  items: T[],
  tab: ContextTab,
): T[] {
  if (tab === "changes") {
    return items.filter(({ item }) => item.type === "fileChange");
  }
  return items;
}
