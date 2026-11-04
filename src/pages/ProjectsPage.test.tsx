// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useProjectList = vi.hoisted(() => vi.fn());
const useCreateProject = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({ useCreateProject, useProjectList }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

describe("ProjectsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    open.mockResolvedValue("/workspace/selected");
    useProjectList.mockReturnValue({
      data: {
        data: [
          {
            id: "project-1",
            name: "Project Alpha",
            roots: [{ path: "/workspace/alpha" }],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useCreateProject.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutate: vi.fn(),
    });
  });

  it("renders projects in a table and keeps the compact creation action", async () => {
    const { ProjectsPage } = await import("./ProjectsPage");

    const { container } = render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(container.firstElementChild?.className).toContain("mx-auto");
    expect(container.firstElementChild?.className).toContain("w-full");
    expect(container.firstElementChild?.className).toContain("max-w-5xl");
    expect(container.firstElementChild?.className).toContain("space-y-6");
    expect(screen.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Your projects" })).toBeNull();
    expect(screen.getByRole("table", { name: "Projects" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Project" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Type" })).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: "Workspace" }),
    ).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Roots" })).toBeTruthy();
    expect(screen.getByText("Project Alpha")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Project Alpha/ }).getAttribute("href"),
    ).toBe("/projects/project-1");
    expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
    expect(screen.queryByLabelText("Project name")).toBeNull();
  });

  it("opens project creation in a modal with visible overflow for metadata popovers", async () => {
    const { ProjectsPage } = await import("./ProjectsPage");

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    const dialog = screen.getByRole("dialog", {
      name: "Create a project",
    });
    expect(dialog.getAttribute("open")).not.toBeNull();
    expect(dialog.querySelector(".modal-box")?.className).toContain(
      "overflow-visible",
    );
    expect(screen.getByRole("textbox", { name: "Project name" })).toBeTruthy();
  });

  it("keeps the empty state concise without an empty project table", async () => {
    useProjectList.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
    const { ProjectsPage } = await import("./ProjectsPage");

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("No projects yet")).toBeTruthy();
    expect(screen.queryByText(/Create your first project/)).toBeNull();
    expect(screen.queryByRole("table", { name: "Projects" })).toBeNull();
    expect(screen.getByRole("button", { name: "Create project" })).toBeTruthy();
  });
});
