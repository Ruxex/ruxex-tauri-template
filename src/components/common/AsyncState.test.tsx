// @vitest-environment jsdom

import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./AsyncState";

describe("EmptyState", () => {
  it("renders a consistent title and action layout without descriptions", () => {
    render(
      <EmptyState
        action={<button type="button">Create one</button>}
        description="Nothing has been created yet."
        icon={CalendarDaysIcon}
        title="No schedules yet"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No schedules yet" }),
    ).toBeTruthy();
    expect(screen.queryByText("Nothing has been created yet.")).toBeNull();
    expect(screen.getByRole("button", { name: "Create one" })).toBeTruthy();
  });

  it("supports a compact layout for dense navigation panels", () => {
    render(<EmptyState compact icon={CalendarDaysIcon} title="No chats yet" />);

    expect(
      screen.getByRole("heading", { name: "No chats yet" }).parentElement
        ?.className,
    ).toContain("py-4");
  });
});
