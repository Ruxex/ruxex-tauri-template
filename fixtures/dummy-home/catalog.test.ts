import { describe, expect, it } from "vitest";

import {
  buildScenarioMarker,
  buildScenarioTitle,
  PERSISTENT_SCENARIOS,
  PROJECT_FIXTURES,
  persistentFixtureCounts,
  VOLATILE_SCENARIOS,
} from "./catalog";

describe("dummy home fixture catalog", () => {
  it("defines unique persistent scenario ids and the expected totals", () => {
    const ids = PERSISTENT_SCENARIOS.map((scenario) => scenario.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("command-list");
    expect(ids).not.toContain("approval-cancelled");
    expect(persistentFixtureCounts()).toEqual({
      total: 19,
      active: 17,
      archived: 2,
    });
  });

  it("builds stable occurrence titles and provider markers", () => {
    const scenario = PERSISTENT_SCENARIOS.find(
      (candidate) => candidate.id === "basic",
    );

    if (!scenario) {
      throw new Error("basic scenario is missing from the catalog");
    }
    expect(buildScenarioTitle(scenario, 1)).toBe("Fixture basic 01");
    expect(buildScenarioMarker(scenario, 1)).toBe(
      "Fixture basic 01 example:basic",
    );
  });

  it("defines rootless projects with the expected thread allocation", () => {
    expect(
      PROJECT_FIXTURES.map((project) => project.threadScenarioIds),
    ).toEqual([["basic", "multi-turn"], ["command-success"], []]);
    expect(
      PROJECT_FIXTURES.every((project) => project.roots.length === 0),
    ).toBe(true);
  });

  it("defines active volatile scenarios and reserves MCP elicitation", () => {
    expect(
      VOLATILE_SCENARIOS.filter((scenario) => scenario.count > 0),
    ).toHaveLength(10);
    expect(
      VOLATILE_SCENARIOS.filter((scenario) => scenario.count > 0).map(
        (scenario) => scenario.id,
      ),
    ).toEqual(
      expect.arrayContaining([
        "long-stream-running",
        "long-stream-completed",
        "completed-turn-details",
        "conversation-minimap",
      ]),
    );
    expect(
      VOLATILE_SCENARIOS.find(
        (scenario) => scenario.id === "pending-mcp-elicitation",
      )?.count,
    ).toBe(0);
  });
});
