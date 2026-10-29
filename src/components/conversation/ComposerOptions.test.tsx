// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ComposerOptions,
  PermissionMenu,
  SubmissionModeMenu,
} from "./ComposerOptions";

describe("ComposerOptions", () => {
  afterEach(cleanup);

  it("groups attachment, goal mode, and plan mode under the plus button", () => {
    const onAttach = vi.fn();
    const onGoalModeChange = vi.fn();
    render(
      <ComposerOptions
        disabled={false}
        onPlanModeChange={vi.fn()}
        onAttach={onAttach}
        onGoalModeChange={onGoalModeChange}
        planMode={false}
        goalMode={false}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByLabelText("Composer options"));
    expect(
      screen.getByRole("menuitem", { name: "Attach file" }),
    ).toHaveProperty("disabled", false);
    expect(screen.getByRole("menuitem", { name: "Goal mode" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Plan mode" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Attach file" }));
    expect(onAttach).toHaveBeenCalledTimes(1);
  });

  it("reports goal mode toggles", () => {
    const onGoalModeChange = vi.fn();
    const onPlanModeChange = vi.fn();
    render(
      <ComposerOptions
        disabled={false}
        onPlanModeChange={onPlanModeChange}
        onAttach={vi.fn()}
        planMode={false}
        goalMode={false}
        onGoalModeChange={onGoalModeChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Composer options"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Goal mode" }));

    expect(onGoalModeChange).toHaveBeenCalledTimes(1);
    expect(onPlanModeChange).not.toHaveBeenCalled();
  });

  it("offers approval, read-only, and full access permission choices", () => {
    const onModeChange = vi.fn();
    render(
      <PermissionMenu
        disabled={false}
        mode="ask"
        onModeChange={onModeChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Permission mode"));
    expect(
      screen.getByRole("menuitem", { name: "Ask for approval" }),
    ).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Read-only" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Full access" }));

    expect(onModeChange).toHaveBeenCalledWith("full-access");
    expect(
      screen.getByLabelText("Permission mode").closest("details")?.open,
    ).toBe(false);
  });

  it("closes an open menu when clicking outside it", () => {
    render(
      <PermissionMenu
        disabled={false}
        mode="ask"
        onModeChange={vi.fn()}
      />,
    );

    const summary = screen.getByLabelText("Permission mode");
    fireEvent.click(summary);
    expect(summary.closest("details")?.open).toBe(true);

    fireEvent.pointerDown(document.body);

    expect(summary.closest("details")?.open).toBe(false);
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
    expect(
      screen
        .getByLabelText("Submission mode menu")
        .parentElement?.className.split(/\s+/),
    ).toContain("dropdown-top");
    fireEvent.click(screen.getByLabelText("Submission mode menu"));
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
    expect(
      screen.getByLabelText("Submission mode menu").closest("details")?.open,
    ).toBe(false);
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

    fireEvent.click(screen.getByLabelText("Submission mode menu"));
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
