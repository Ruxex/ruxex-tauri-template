// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ComposerOptions, SubmissionModeMenu } from "./ComposerOptions";

describe("ComposerOptions", () => {
  afterEach(cleanup);

  it("renders only composer options without a mode select", () => {
    const onAttach = vi.fn();
    render(
      <ComposerOptions
        activeTurnId={null}
        disabled={false}
        onPlanModeChange={vi.fn()}
        onAttach={onAttach}
        planMode={false}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
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

  it("reports plan toggles for an active turn", () => {
    const onModeChange = vi.fn();
    const onPlanModeChange = vi.fn();
    render(
      <ComposerOptions
        activeTurnId="turn-1"
        disabled={false}
        onPlanModeChange={onPlanModeChange}
        onAttach={vi.fn()}
        planMode={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Plan mode" }));

    expect(onModeChange).not.toHaveBeenCalled();
    expect(onPlanModeChange).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Plan mode" }).querySelector("svg"),
    ).toBeTruthy();
  });

  it("offers send, steer, and queue from the submission mode menu", () => {
    const onModeChange = vi.fn();
    render(
      <SubmissionModeMenu
        activeTurnId="turn-1"
        disabled={false}
        mode="send"
        onModeChange={onModeChange}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Submission mode menu" }),
    );
    expect(screen.getByRole("menuitem", { name: "Send" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("menuitem", { name: /Steer/ })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("menuitem", { name: /Queue/ })).toHaveProperty(
      "disabled",
      false,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: /Queue/ }));
    expect(onModeChange).toHaveBeenCalledWith("queue");
  });

  it("disables steer and queue without an active turn", () => {
    render(
      <SubmissionModeMenu
        activeTurnId={null}
        disabled={false}
        mode="send"
        onModeChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Submission mode menu" }),
    );
    expect(screen.getByRole("menuitem", { name: /Steer/ })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("menuitem", { name: /Queue/ })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
