import { describe, expect, it } from "vitest";

import {
  CONTEXT_TABS,
  contextTabLabel,
  filterContextItems,
  isContextTab,
} from "./context-model";

describe("context drawer selectors", () => {
  it("exposes the three workbench context tabs", () => {
    expect(CONTEXT_TABS).toEqual(["activity", "changes", "context"]);
    expect(contextTabLabel("activity")).toBe("Activity");
    expect(contextTabLabel("changes")).toBe("Changes");
    expect(contextTabLabel("context")).toBe("Context");
  });

  it("accepts only server-backed context tab values", () => {
    expect(isContextTab("changes")).toBe(true);
    expect(isContextTab("local-notes")).toBe(false);
  });

  it("filters file-change activity without creating a client-only record", () => {
    const items = [
      { item: { id: "message", type: "agentMessage" } },
      { item: { id: "change", type: "fileChange" } },
      { item: { id: "command", type: "commandExecution" } },
    ] as never[];

    expect(filterContextItems(items, "changes")).toEqual([
      { item: { id: "change", type: "fileChange" } },
    ]);
    expect(filterContextItems(items, "activity")).toHaveLength(3);
  });
});
