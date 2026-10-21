import { describe, expect, it } from "vitest";

import {
  CONTEXT_TABS,
  contextTabLabel,
  filterContextItems,
  isContextTab,
} from "./context-model";

describe("context model", () => {
  it("labels every supported context tab", () => {
    expect(CONTEXT_TABS.map(contextTabLabel)).toEqual([
      "Activity",
      "Changes",
      "Context",
    ]);
  });

  it("accepts only supported context tab names", () => {
    expect(CONTEXT_TABS.every(isContextTab)).toBe(true);
    expect(isContextTab("unknown")).toBe(false);
    expect(isContextTab("")).toBe(false);
  });

  it("filters only file-change items in the changes tab", () => {
    const items = [
      { item: { type: "agentMessage" }, turnId: "turn-1" },
      { item: { type: "fileChange" }, turnId: "turn-1" },
      { item: { type: "commandExecution" }, turnId: "turn-1" },
    ];

    expect(filterContextItems(items, "changes")).toEqual([items[1]]);
    expect(filterContextItems(items, "activity")).toEqual(items);
    expect(filterContextItems(items, "context")).toEqual(items);
  });
});
