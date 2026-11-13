// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectSelector } from "./ProjectSelector";

describe("ProjectSelector", () => {
  afterEach(cleanup);

  it("searches projects and allows selecting no project or an available project", () => {
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

    fireEvent.click(screen.getByLabelText("Project"));
    const selector = screen.getByRole("combobox", { name: "Search projects" });
    expect(screen.getByRole("option", { name: "No project" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Project Alpha" })).toBeTruthy();

    fireEvent.change(selector, { target: { value: "beta" } });
    expect(screen.queryByRole("option", { name: "Project Alpha" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Project Beta" }));

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

    fireEvent.click(screen.getByLabelText("Project"));
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

    fireEvent.click(screen.getByLabelText("Project"));
    expect(screen.getByText("Unable to load projects.")).toBeTruthy();
  });

  it("shows no project when the project list is empty", () => {
    render(
      <ProjectSelector
        isError={false}
        isLoading={false}
        onChange={vi.fn()}
        projects={[]}
        value=""
      />,
    );

    fireEvent.click(screen.getByLabelText("Project"));
    expect(screen.getByText("No projects yet.")).toBeTruthy();
    expect(screen.getByRole("option", { name: "No project" })).toBeTruthy();
  });
});
