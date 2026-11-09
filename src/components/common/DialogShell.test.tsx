// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DialogShell } from "./DialogShell";

describe("DialogShell", () => {
  afterEach(cleanup);

  it("renders a labeled open dialog and closes from the header", () => {
    const onClose = vi.fn();

    render(
      <DialogShell
        closeLabel="Close settings"
        onClose={onClose}
        open
        title="Settings"
      >
        <p>Content</p>
      </DialogShell>,
    );

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("Content")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Close settings" })[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render closed dialog content", () => {
    render(
      <DialogShell onClose={() => undefined} open={false} title="Settings">
        <p>Hidden content</p>
      </DialogShell>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Hidden content")).toBeNull();
  });
});
