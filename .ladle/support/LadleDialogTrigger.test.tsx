// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LadleDialogTrigger } from "./LadleDialogTrigger";

describe("LadleDialogTrigger", () => {
  afterEach(cleanup);

  it("opens the dialog only after clicking the trigger and closes it again", () => {
    render(
      <LadleDialogTrigger
        renderDialog={(onClose) => (
          <div role="dialog">
            <button type="button" onClick={onClose}>
              Close dialog
            </button>
          </div>
        )}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
