import { describe, expect, it, vi } from "vitest";

import { PERSISTENT_SCENARIOS } from "./catalog";
import {
  MINIMAP_TURN_COUNT,
  minimapFixturePrompt,
  saveFixtureScreenshot,
  scenarioExpectation,
  scenarioPrompt,
  withWindowSize,
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

  it("defines seven deterministic turns for the minimap fixture", () => {
    expect(MINIMAP_TURN_COUNT).toBeGreaterThanOrEqual(7);
    expect(minimapFixturePrompt(1)).toBe(
      "Fixture minimap message 01 example:basic",
    );
    expect(minimapFixturePrompt(MINIMAP_TURN_COUNT)).toContain(
      `message ${String(MINIMAP_TURN_COUNT).padStart(2, "0")}`,
    );
  });

  it("restores the original window size after a scoped resize", async () => {
    const getWindowSize = vi.fn(async () => ({ width: 1280, height: 800 }));
    const setWindowSize = vi.fn(async () => undefined);
    vi.stubGlobal("browser", { getWindowSize, setWindowSize });

    try {
      await withWindowSize(1920, 800, async () => undefined);

      expect(setWindowSize).toHaveBeenNthCalledWith(1, 1920, 800);
      expect(setWindowSize).toHaveBeenNthCalledWith(2, 1280, 800);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
