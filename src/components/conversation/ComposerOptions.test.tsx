// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerOptions } from "./ComposerOptions";

describe("ComposerOptions", () => {
  afterEach(cleanup);

  it("disables active-turn modes until a turn exists", () => {
    render(
      <ComposerOptions
        activeTurnId={null}
        disabled={false}
        mode="send"
        onModeChange={vi.fn()}
        onPlanModeChange={vi.fn()}
        planMode={false}
      />,
    );

    expect(screen.getByRole("option", { name: "Steer active turn" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("option", { name: "Queue next message" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Attach" })).toHaveProperty("disabled", true);
  });

  it("reports queue selection and plan toggles for an active turn", () => {
    const onModeChange = vi.fn();
    const onPlanModeChange = vi.fn();
    render(
      <ComposerOptions
        activeTurnId="turn-1"
        disabled={false}
        mode="send"
        onModeChange={onModeChange}
        onPlanModeChange={onPlanModeChange}
        planMode={false}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Submission mode" }), { target: { value: "queue" } });
    fireEvent.click(screen.getByRole("button", { name: "Plan mode" }));

    expect(onModeChange).toHaveBeenCalledWith("queue");
    expect(onPlanModeChange).toHaveBeenCalledTimes(1);
  });
});
