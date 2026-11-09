import { describe, expect, it } from "vitest";

import type { v2 } from "../../protocol";
import { defaultEffortForModel } from "./useComposerSelection";

describe("defaultEffortForModel", () => {
  it("returns no effort when a model is unavailable", () => {
    expect(defaultEffortForModel(undefined)).toBe("");
  });

  it("returns no effort when a model does not support reasoning efforts", () => {
    const model = {
      supportedReasoningEfforts: [],
    } as unknown as v2.Model;

    expect(defaultEffortForModel(model)).toBe("");
  });
});
