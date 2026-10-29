// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useProjectList = vi.hoisted(() => vi.fn());
const useCreateProject = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({ useProjectList, useCreateProject }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

describe("ProjectsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
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
    open.mockResolvedValue("/workspace/selected");
  });

  it("renders projects in a table and keeps the compact creation action", async () => {
    const { ProjectsPage } = await import("./ProjectsPage");

    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Projects" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Project" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Type" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Workspace" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Roots" })).toBeTruthy();
    expect(screen.getByText("Project Alpha")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Project Alpha/ }).getAttribute("href"),
    ).toBe("/projects/project-1");
    expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
    expect(screen.queryByLabelText("Project name")).toBeNull();
  });

  it("creates a project from the form", async () => {
    const { ProjectsPage } = await import("./ProjectsPage");
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "New project" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Project icon" }), {
      target: { value: "code" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Project color" }), {
      target: { value: "violet" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Select workspace folder" }),
    );
    await waitFor(() =>
      expect(screen.getByText("/workspace/selected")).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    const create = useCreateProject.mock.results[0]?.value;
    expect(create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New project",
        roots: [{ path: "/workspace/selected" }],
        metadata: { icon: "code", color: "violet" },
        idempotencyKey: expect.any(String),
      }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("clears the selected workspace folder", async () => {
    const { ProjectsPage } = await import("./ProjectsPage");
    render(
      <MemoryRouter>
        <ProjectsPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select workspace folder" }),
    );
    await waitFor(() =>
      expect(screen.getByText("/workspace/selected")).toBeTruthy(),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear workspace folder" }),
    );

    expect(
      screen.getByRole("button", { name: "Select workspace folder" }),
    ).toBeTruthy();
  });
});
