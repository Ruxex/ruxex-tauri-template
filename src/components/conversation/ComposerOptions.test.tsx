// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerOptions } from "./ComposerOptions";

describe("ComposerOptions", () => {
  afterEach(cleanup);

  it("disables active-turn modes until a turn exists", () => {
    const onAttach = vi.fn();
    render(
      <ComposerOptions
        activeTurnId={null}
        disabled={false}
        mode="send"
        onModeChange={vi.fn()}
        onPlanModeChange={vi.fn()}
        onAttach={onAttach}
        planMode={false}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Steer active turn" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("option", { name: "Queue next message" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Attach image" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(
      screen.getByRole("button", { name: "Attach image" }).querySelector("svg"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Attach image" }));
    expect(onAttach).toHaveBeenCalledTimes(1);
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
        onAttach={vi.fn()}
        planMode={false}
      />,
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Submission mode" }),
      { target: { value: "queue" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Plan mode" }));

    expect(onModeChange).toHaveBeenCalledWith("queue");
    expect(onPlanModeChange).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Plan mode" }).querySelector("svg"),
    ).toBeTruthy();
  });
});
