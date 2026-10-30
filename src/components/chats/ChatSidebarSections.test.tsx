// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const useProjectList = vi.hoisted(() => vi.fn());
const useThreadList = vi.hoisted(() => vi.fn());
const useThreadActivity = vi.hoisted(() => vi.fn());
const useArchiveThread = vi.hoisted(() => vi.fn());
const activeThreadListParams = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useProjectList,
  useThreadList,
  useThreadActivity,
  useArchiveThread,
  activeThreadListParams,
}));

describe("ChatSidebarSections", () => {
  afterEach(cleanup);

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
    const archiveThread = vi.fn();
    useArchiveThread.mockReturnValue({
      isPending: false,
      mutateAsync: archiveThread,
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
    expect(links[1].parentElement?.className).toContain("bg-base-200");
    expect(
      screen.getByRole("button", { name: "Archive Build the sidebar" }),
    ).toBeTruthy();

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
    fireEvent.click(
      screen.getByRole("button", { name: "Archive Build the sidebar" }),
    );
    expect(archiveThread).toHaveBeenCalledWith({ threadId: "thread-1" });
  });

  it("expands each project independently with project-scoped recent chats", async () => {
    activeThreadListParams.mockReturnValue({
      archived: false,
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
    useProjectList.mockReturnValue({
      data: {
        data: [
          { id: "project-1", name: "Project Alpha" },
          { id: "project-2", name: "Project Beta" },
        ],
      },
      isError: false,
      isLoading: false,
    });
    useThreadList.mockReset();
    useThreadList.mockImplementation((params: { projectId?: string }) => {
      if (params.projectId === "project-1") {
        return {
          data: {
            data: [
              {
                id: "alpha-newest",
                name: "Alpha newest",
                preview: null,
                updatedAt: 20,
              },
              {
                id: "alpha-older",
                name: "Alpha older",
                preview: null,
                updatedAt: 10,
              },
            ],
          },
          isError: false,
          isLoading: false,
        };
      }
      if (params.projectId === "project-2") {
        return {
          data: {
            data: [
              {
                id: "beta-chat",
                name: "Beta chat",
                preview: null,
                updatedAt: 5,
              },
            ],
          },
          isError: false,
          isLoading: false,
        };
      }
      return {
        data: { data: [] },
        isError: false,
        isLoading: false,
      };
    });
    useThreadActivity.mockReturnValue({
      status: undefined,
      waitingForRequest: false,
    });
    const archiveThread = vi.fn();
    useArchiveThread.mockReturnValue({
      isPending: false,
      mutateAsync: archiveThread,
    });
    const { ChatSidebarSections } = await import("./ChatSidebarSections");

    render(
      <MemoryRouter>
        <ChatSidebarSections onClose={vi.fn()} />
      </MemoryRouter>,
    );

    const alphaDisclosure = screen.getByRole("button", {
      name: "Expand Project Alpha",
    });
    const betaDisclosure = screen.getByRole("button", {
      name: "Expand Project Beta",
    });
    expect(alphaDisclosure.getAttribute("aria-expanded")).toBe("false");
    expect(betaDisclosure.getAttribute("aria-expanded")).toBe("false");
    expect(
      useThreadList.mock.calls.some(
        ([params]) => params?.projectId === "project-2",
      ),
    ).toBe(false);

    fireEvent.click(alphaDisclosure);

    expect(alphaDisclosure.getAttribute("aria-expanded")).toBe("true");
    expect(betaDisclosure.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen
        .getAllByRole("link")
        .filter((link) => link.getAttribute("href")?.startsWith("/chat/alpha-"))
        .map((link) => link.textContent?.trim()),
    ).toEqual(["Alpha newest", "Alpha older"]);
    expect(useThreadList).toHaveBeenCalledWith({
      projectId: "project-1",
      archived: false,
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
    expect(
      useThreadList.mock.calls.some(
        ([params]) => params?.projectId === "project-2",
      ),
    ).toBe(false);

    fireEvent.click(betaDisclosure);

    expect(alphaDisclosure.getAttribute("aria-expanded")).toBe("true");
    expect(betaDisclosure.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Beta chat" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive Beta chat" }));
    expect(archiveThread).toHaveBeenCalledWith({ threadId: "beta-chat" });
  });
});
