// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const useProjectList = vi.hoisted(() => vi.fn());
const useThreadList = vi.hoisted(() => vi.fn());
const useThreadActivity = vi.hoisted(() => vi.fn());
const activeThreadListParams = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useProjectList,
  useThreadList,
  useThreadActivity,
  activeThreadListParams,
}));

describe("ChatSidebarSections", () => {
  it("orders chat navigation without a Settings link", async () => {
    activeThreadListParams.mockReturnValue({
      archived: false,
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
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
    useThreadActivity.mockReturnValue({
      status: undefined,
      waitingForRequest: false,
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
    const recentChatList = recentChats.closest("details")?.querySelector("ul");
    expect(recentChatList?.className).toContain("gap-0");
    expect(recentChatList?.className).not.toContain("gap-1");

    onClose.mockClear();
    fireEvent.click(links[1]);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(recentChats);
    expect(recentChats.closest("details")?.open).toBe(false);

    fireEvent.click(projects);
    expect(projects.closest("details")?.open).toBe(false);

    onClose.mockClear();
    fireEvent.click(links[0]);
    expect(onClose).not.toHaveBeenCalled();
  });
});
