// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useParams = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const useProjectThreads = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useParams };
});
vi.mock("../app-server/hooks", () => ({ useProject, useProjectThreads }));
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
  });

  it("renders the project workspace and task list", async () => {
    const { ProjectHomePage } = await import("./ProjectHomePage");

    render(
      <MemoryRouter>
        <ProjectHomePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Ruxex" })).toBeTruthy();
    expect(screen.getByText("/workspace")).toBeTruthy();
    expect(screen.getByText("Project chat")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tasks" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "New task" }).getAttribute("href"),
    ).toBe("/?projectId=project-1");
    expect(screen.getByText("Project menu")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Settings" }).getAttribute("href"),
    ).toBe("/settings");
    expect(screen.queryByTestId("worktree-card")).toBeNull();
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
