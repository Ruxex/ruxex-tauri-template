import { describe, expect, it, vi } from "vitest";

import { PERSISTENT_SCENARIOS } from "./catalog";
import {
  saveFixtureScreenshot,
  scenarioExpectation,
  scenarioPrompt,
} from "./support";

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

  it("waits 300ms before and after saving a fixture screenshot", async () => {
    const pause = vi.fn(async () => undefined);
    const saveScreenshot = vi.fn(async () => undefined);
    vi.stubGlobal("browser", { pause, saveScreenshot });

    try {
      await saveFixtureScreenshot("stability.png");

      expect(pause).toHaveBeenNthCalledWith(1, 300);
      expect(pause).toHaveBeenNthCalledWith(2, 300);
      expect(pause).toHaveBeenCalledTimes(2);
      expect(saveScreenshot).toHaveBeenCalledTimes(1);
      expect(pause.mock.invocationCallOrder[0]).toBeLessThan(
        saveScreenshot.mock.invocationCallOrder[0],
      );
      expect(pause.mock.invocationCallOrder[1]).toBeGreaterThan(
        saveScreenshot.mock.invocationCallOrder[0],
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
