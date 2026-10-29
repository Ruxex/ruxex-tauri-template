// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectSelector } from "./ProjectSelector";

describe("ProjectSelector", () => {
  it("allows no project or one of the available projects", () => {
    const onChange = vi.fn();

    render(
      <ProjectSelector
        isError={false}
        isLoading={false}
        onChange={onChange}
        projects={[
          { id: "project-1", name: "Project Alpha" },
          { id: "project-2", name: "Project Beta" },
        ]}
        value=""
      />,
    );

    const selector = screen.getByLabelText("Project");
    expect(screen.getByRole("option", { name: "No project" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Project Alpha" }),
    ).toBeTruthy();

    fireEvent.change(selector, { target: { value: "project-2" } });

    expect(onChange).toHaveBeenCalledWith("project-2");
  });

  it("renders loading and error states without requiring project data", () => {
    const { rerender } = render(
      <ProjectSelector
        isError={false}
        isLoading
        onChange={vi.fn()}
        projects={[]}
        value=""
      />,
    );

    expect(screen.getByText("Loading projects…")).toBeTruthy();

    rerender(
      <ProjectSelector
        isError
        isLoading={false}
        onChange={vi.fn()}
        projects={[]}
        value=""
      />,
    );

    expect(screen.getByText("Unable to load projects.")).toBeTruthy();
  });
});
