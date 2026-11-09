// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { v2 } from "../../protocol";
import { ComposerSettings } from "./ComposerSettings";

describe("ComposerSettings", () => {
  afterEach(cleanup);

  it("omits the effort label when the selected model has no efforts", () => {
    const model = {
      displayName: "Unavailable effort model",
      hidden: false,
      id: "model-1",
      isDefault: true,
      model: "model-1",
      supportedReasoningEfforts: [],
    } as unknown as v2.Model;

    render(
      <ComposerSettings
        disabled={false}
        effort=""
        model="model-1"
        models={[model]}
        onEffortChange={vi.fn()}
        onModelChange={vi.fn()}
      />,
    );

    const summary = screen.getByLabelText("Model and effort");
    expect(summary.textContent).toBe("Unavailable effort model");
    expect(summary.textContent).not.toContain("medium");
    expect(summary.textContent).not.toContain("·");
  });

  it("omits a stale effort label that is not supported by the selected model", () => {
    const model = {
      displayName: "High-only model",
      hidden: false,
      id: "model-1",
      isDefault: true,
      model: "model-1",
      supportedReasoningEfforts: [
        { reasoningEffort: "high", description: "Deep" },
      ],
    } as unknown as v2.Model;

    render(
      <ComposerSettings
        disabled={false}
        effort=""
        model="model-1"
        models={[model]}
        onEffortChange={vi.fn()}
        onModelChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Model and effort").textContent).toBe(
      "High-only model",
    );
  });
});
