// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DialogFooter, DialogHeader } from "./DialogParts";

describe("DialogParts", () => {
  it("provides the shared header and footer layout", () => {
    render(
      <>
        <DialogHeader
          closeLabel="Close test dialog"
          onClose={() => undefined}
          title="Test dialog"
          titleId="test-dialog-title"
        />
        <DialogFooter>
          <button type="button">Save</button>
        </DialogFooter>
      </>,
    );

    expect(screen.getByRole("heading", { name: "Test dialog" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Close test dialog" }),
    ).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });
});
