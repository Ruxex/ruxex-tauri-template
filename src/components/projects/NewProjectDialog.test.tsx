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

vi.mock("../../app-server/hooks", () => ({ useCreateProject }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe("NewProjectDialog", () => {
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

  it("renders as a modal with visible overflow for metadata popovers", async () => {
    const { NewProjectDialog } = await import("./NewProjectDialog");

    render(
      <MemoryRouter>
        <NewProjectDialog onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const dialog = screen.getByRole("dialog", { name: "Create a project" });
    expect(dialog.querySelector(".modal-box")?.className).toContain(
      "overflow-visible",
    );
  });

  it("supports restoring a draft with a selected workspace folder", async () => {
    const { NewProjectDialog } = await import("./NewProjectDialog");

    render(
      <MemoryRouter>
        <NewProjectDialog
          initialName="Design system"
          initialRoot="/workspace/design-system"
          onClose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("textbox", { name: "Project name" }).getAttribute(
        "value",
      ),
    ).toBe("Design system");
    expect(
      screen.getByRole("button", {
        name: "Selected workspace folder: /workspace/design-system",
      }),
    ).toBeTruthy();
  });

  it("creates a project with the selected metadata and workspace root", async () => {
    const { NewProjectDialog } = await import("./NewProjectDialog");
    render(
      <MemoryRouter>
        <NewProjectDialog onClose={vi.fn()} />
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
    const { NewProjectDialog } = await import("./NewProjectDialog");
    render(
      <MemoryRouter>
        <NewProjectDialog onClose={vi.fn()} />
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

  it("shows inline validation when the project name is missing", async () => {
    const { NewProjectDialog } = await import("./NewProjectDialog");
    render(
      <MemoryRouter>
        <NewProjectDialog onClose={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Enter a project name",
    );
    expect(
      screen.getByRole("textbox", { name: "Project name" }).getAttribute(
        "aria-invalid",
      ),
    ).toBe("true");
  });

  it("navigates to the created project after success", async () => {
    const mutate = vi.fn();
    useCreateProject.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutate,
    });
    const { NewProjectDialog } = await import("./NewProjectDialog");
    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <Routes>
          <Route
            path="/projects"
            element={<NewProjectDialog onClose={vi.fn()} />}
          />
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
