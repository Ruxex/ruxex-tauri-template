// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useProjectList = vi.hoisted(() => vi.fn());
const useThreadList = vi.hoisted(() => vi.fn());
const useAppServerEvents = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useProjectList,
  useThreadList,
  useAppServerEvents,
}));

describe("TaskSidebarSections", () => {
  it("orders task navigation and keeps Settings at the bottom", async () => {
    useProjectList.mockReturnValue({
      data: { data: [{ id: "project-1", name: "Project Alpha" }] },
      isError: false,
      isLoading: false,
    });
    useThreadList.mockReturnValue({
      data: {
        data: [
          {
            id: "thread-1",
            name: "Build the sidebar",
            preview: "Implement the task sidebar",
            updatedAt: 0,
          },
        ],
      },
      isError: false,
      isLoading: false,
    });
    useAppServerEvents.mockReturnValue({
      pendingServerRequests: {},
      threads: {},
    });
    const onClose = vi.fn();
    const { TaskSidebarSections } = await import("./TaskSidebarSections");

    render(
      <MemoryRouter>
        <TaskSidebarSections onClose={onClose} selectedThreadId="thread-1" />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Task navigation",
    });
    const links = within(navigation).getAllByRole("link");

    expect(links[0].textContent?.trim()).toBe("New task");
    expect(links[1].textContent).toContain("Build the sidebar");
    expect(links[2].textContent?.trim()).toContain("Project Alpha");
    expect(links[3].textContent?.trim()).toBe("Settings");
    expect(links[0].getAttribute("href")).toBe("/");
    expect(links[1].getAttribute("href")).toBe("/chat/thread-1");
    expect(links[2].getAttribute("href")).toBe("/projects/project-1");
    expect(links[3].getAttribute("href")).toBe("/settings");
    expect(links[1].className).toContain("bg-base-200");

    links[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
