// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useCreateProject = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({ useCreateProject }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe("NewProjectPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useCreateProject.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutate: vi.fn(),
    });
    open.mockResolvedValue("/workspace/selected");
  });

  it("renders a page form with a link back to projects", async () => {
    const { NewProjectPage } = await import("./NewProjectPage");
    const { container } = render(
      <MemoryRouter>
        <NewProjectPage />
      </MemoryRouter>,
    );

    expect(container.firstElementChild?.className).toContain("mx-auto");
    expect(container.firstElementChild?.className).toContain("max-w-3xl");
    expect(
      screen.getByRole("heading", { name: "Create a project" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Back to projects" })
        .getAttribute("href"),
    ).toBe("/projects");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("creates a project with the selected metadata and workspace root", async () => {
    const { NewProjectPage } = await import("./NewProjectPage");
    render(
      <MemoryRouter>
        <NewProjectPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "New project" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Project icon: Folder" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Project color: Blue" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Violet" }));
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

  it("does not submit a blank project name", async () => {
    const { NewProjectPage } = await import("./NewProjectPage");
    render(
      <MemoryRouter>
        <NewProjectPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      useCreateProject.mock.results[0]?.value.mutate,
    ).not.toHaveBeenCalled();
  });

  it("navigates to the created project after success", async () => {
    const mutate = vi.fn();
    useCreateProject.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutate,
    });
    const { NewProjectPage } = await import("./NewProjectPage");
    render(
      <MemoryRouter initialEntries={["/projects/new"]}>
        <Routes>
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "New project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    const options = mutate.mock.calls[0]?.[1];
    options.onSuccess({ project: { id: "project-new" } });

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/projects/project-new",
      ),
    );
  });
});
