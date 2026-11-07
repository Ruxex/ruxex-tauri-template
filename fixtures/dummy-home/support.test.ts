import { describe, expect, it } from "vitest";

import { PERSISTENT_SCENARIOS } from "./catalog";
import { scenarioExpectation, scenarioPrompt } from "./support";

describe("dummy home WDIO support contracts", () => {
  it("builds a deterministic prompt for every persistent scenario", () => {
    for (const scenario of PERSISTENT_SCENARIOS) {
      const prompt = scenarioPrompt(scenario, 1);

      expect(prompt).toContain(scenario.providerMarker);
      expect(prompt).toContain(
        `Fixture ${scenario.id.replaceAll("-", " ")} 01`,
      );
    }
  });

  it("maps each persistent scenario to a renderable expectation", () => {
    for (const scenario of PERSISTENT_SCENARIOS) {
      const expectation = scenarioExpectation(scenario);

      expect(expectation.kind).toMatch(/^(text|error|goal)$/);
      expect(expectation.value.length).toBeGreaterThan(0);
    }
  });
});
