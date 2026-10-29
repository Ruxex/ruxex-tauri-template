// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useParams = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const useProjectThreads = vi.hoisted(() => vi.fn());
const useUpdateProject = vi.hoisted(() => vi.fn());
const useDeleteProject = vi.hoisted(() => vi.fn());
const open = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useParams };
});
vi.mock("../app-server/hooks", () => ({
  useDeleteProject,
  useProject,
  useProjectThreads,
  useUpdateProject,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
vi.mock("../components/common/ThreadCard", () => ({
  ThreadCard: ({
    thread,
  }: {
    thread: { id: string; name?: string | null };
  }) => <div data-testid="project-thread">{thread.name ?? thread.id}</div>,
}));
describe("ProjectHomePage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    open.mockReset();
    open.mockResolvedValue("/workspace/selected");
    useParams.mockReturnValue({ projectId: "project-1" });
    useProject.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        project: {
          id: "project-1",
          name: "Ruxex",
          roots: [{ path: "/workspace" }],
        },
      },
    });
    useProjectThreads.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [{ id: "thread-1", name: "Project chat" }] },
    });
    useUpdateProject.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    });
    useDeleteProject.mockReturnValue({
      isPending: false,
      mutate: vi.fn(),
    });
  });

  it("renders the project workspace and chat list with project actions", async () => {
    const { ProjectHomePage } = await import("./ProjectHomePage");

    render(
      <MemoryRouter>
        <ProjectHomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Ruxex" })).toBeTruthy();
    expect(screen.getByText("/workspace")).toBeTruthy();
    expect(screen.getByText("Project chat")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Chats" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "New chat" }).getAttribute("href"),
    ).toBe("/?projectId=project-1");
    expect(screen.getByRole("button", { name: "Edit project" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete project" })).toBeTruthy();
    expect(screen.getByText("Project menu")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Settings" }).getAttribute("href"),
    ).toBe("/settings");
    expect(screen.queryByTestId("worktree-card")).toBeNull();
  });

  it("updates the project name and workspace root from the edit dialog", async () => {
    const mutate = vi.fn();
    useUpdateProject.mockReturnValue({ isPending: false, mutate });
    const { ProjectHomePage } = await import("./ProjectHomePage");

    render(
      <MemoryRouter>
        <ProjectHomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "  Updated Ruxex  " },
    });
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Selected workspace folder: /workspace",
      }),
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Selected workspace folder: /workspace/selected",
        }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));

    expect(mutate).toHaveBeenCalledWith(
      {
        projectId: "project-1",
        name: "Updated Ruxex",
        roots: [{ path: "/workspace/selected" }],
      },
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );
  });

  it("does not submit an edit with a blank project name", async () => {
    const mutate = vi.fn();
    useUpdateProject.mockReturnValue({ isPending: false, mutate });
    const { ProjectHomePage } = await import("./ProjectHomePage");

    render(
      <MemoryRouter>
        <ProjectHomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit project" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save project" }));

    expect(mutate).not.toHaveBeenCalled();
  });

  it("deletes the project and navigates back to the project list", async () => {
    const mutate = vi.fn((_params, options) => options.onSuccess());
    useDeleteProject.mockReturnValue({ isPending: false, mutate });
    const { ProjectHomePage } = await import("./ProjectHomePage");

    function LocationProbe() {
      return <output data-testid="location">{useLocation().pathname}</output>;
    }

    render(
      <MemoryRouter initialEntries={["/projects/project-1"]}>
        <ProjectHomePage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Ruxex/)).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete project" }),
    );

    expect(mutate).toHaveBeenCalledWith(
      { projectId: "project-1" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(screen.getByTestId("location").textContent).toBe("/projects");
  });

  it("keeps the delete dialog open and shows a mutation error", async () => {
    const mutate = vi.fn((_params, options) =>
      options.onError(new Error("delete failed")),
    );
    useDeleteProject.mockReturnValue({ isPending: false, mutate });
    const { ProjectHomePage } = await import("./ProjectHomePage");

    render(
      <MemoryRouter>
        <ProjectHomePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete project" }),
    );

    expect(screen.getByRole("alert").textContent).toContain("delete failed");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("explains when a project has no workspace root", async () => {
    useProject.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        project: {
          id: "project-1",
          name: "Ruxex",
          roots: [],
        },
      },
    });
    const { ProjectHomePage } = await import("./ProjectHomePage");

    render(
      <MemoryRouter>
        <ProjectHomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("No workspace root configured")).toBeTruthy();
  });

  it("renders a stable error state when project loading fails", async () => {
    useProject.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    });
    const { ProjectHomePage } = await import("./ProjectHomePage");

    render(
      <MemoryRouter>
        <ProjectHomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unable to load this project.")).toBeTruthy();
  });
});
