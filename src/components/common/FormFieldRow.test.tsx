// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormFieldRow } from "./FormFieldRow";

describe("FormFieldRow", () => {
  it("associates its label with the control and preserves the field layout", () => {
    render(
      <FormFieldRow controlId="project-name" label="Project name">
        <input id="project-name" />
      </FormFieldRow>,
    );

    expect(screen.getByLabelText("Project name")).toBeTruthy();
    expect(screen.getByText("Project name").closest("div")?.className).toContain(
      "grid-cols-[minmax(0,1fr)_minmax(12rem,40%)]",
    );
  });
});
