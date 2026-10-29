// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("ChatSidebarSections", () => {
  it("orders chat navigation without a Settings link", async () => {
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
            preview: "Implement the chat sidebar",
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
    const { ChatSidebarSections } = await import("./ChatSidebarSections");

    render(
      <MemoryRouter>
        <ChatSidebarSections onClose={onClose} selectedThreadId="thread-1" />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Chat navigation",
    });
    const links = within(navigation).getAllByRole("link");

    expect(links[0].textContent?.trim()).toBe("New chat");
    expect(links[1].textContent).toContain("Build the sidebar");
    expect(links[2].textContent?.trim()).toContain("Project Alpha");
    expect(links).toHaveLength(3);
    expect(links[0].getAttribute("href")).toBe("/");
    expect(links[1].getAttribute("href")).toBe("/chat/thread-1");
    expect(links[2].getAttribute("href")).toBe("/projects/project-1");
    expect(links[1].className).toContain("bg-base-200");

    const recentChats = screen
      .getByText("Recent chats")
      .closest("summary") as HTMLElement;
    const projects = screen
      .getByText("Projects")
      .closest("summary") as HTMLElement;
    expect(recentChats.querySelector("svg")).toBeTruthy();
    expect(recentChats.querySelector("svg")?.getAttribute("class")).toContain(
      "group-open:rotate-90",
    );
    expect(projects.querySelector("svg")).toBeTruthy();
    expect(projects.querySelector("svg")?.getAttribute("class")).toContain(
      "group-open:rotate-90",
    );
    expect(recentChats.closest("details")?.open).toBe(true);
    expect(projects.closest("details")?.open).toBe(true);

    fireEvent.click(recentChats);
    expect(recentChats.closest("details")?.open).toBe(false);

    fireEvent.click(projects);
    expect(projects.closest("details")?.open).toBe(false);

    links[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
