// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useReducer } from "react";
import { describe, expect, it } from "vitest";

import { ScheduleEditorDialog } from "./ScheduleEditorDialog";
import { createScheduleFormState, scheduleFormReducer } from "./schedule-form";

function renderWeeklyEditor() {
  function TestEditor() {
    const [form, dispatch] = useReducer(
      scheduleFormReducer,
      createScheduleFormState(),
      (state) => ({
        ...state,
        cadenceKind: "weekly" as const,
        weekdays: ["1", "3"],
      }),
    );

    return (
      <ScheduleEditorDialog
        dispatch={dispatch}
        error={null}
        form={form}
        isEditing={false}
        isPending={false}
        onClose={() => undefined}
        onSubmit={(event) => event.preventDefault()}
      />
    );
  }

  render(<TestEditor />);
}

describe("ScheduleEditorDialog", () => {
  it("places weekday toggles below cadence and toggles each weekday button", () => {
    renderWeeklyEditor();

    const cadence = screen.getByLabelText("Cadence");
    const weekdays = screen.getByRole("group", { name: "Weekdays" });
    const layout = cadence.parentElement?.parentElement;

    expect(layout?.className).not.toContain("sm:grid-cols-2");
    expect(
      cadence.compareDocumentPosition(weekdays) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.queryAllByRole("checkbox", { name: /Weekday/ })).toHaveLength(
      0,
    );

    expect(
      within(weekdays)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["S", "M", "T", "W", "T", "F", "S"]);

    expect(
      screen
        .getByRole("button", { name: "Monday" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Tuesday" })
        .getAttribute("aria-pressed"),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));

    expect(
      screen
        .getByRole("button", { name: "Monday" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Tuesday" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});
