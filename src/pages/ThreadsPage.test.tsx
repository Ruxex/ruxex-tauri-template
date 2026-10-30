// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useThreadList = vi.hoisted(() => vi.fn());
const useThreadSearch = vi.hoisted(() => vi.fn());
const useAppServerEvents = vi.hoisted(() => vi.fn());
const activeThreadListParams = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useAppServerEvents,
  activeThreadListParams,
  useThreadList,
  useThreadSearch,
}));
vi.mock("../components/common/ThreadCard", () => ({
  ThreadCard: ({
    thread,
  }: {
    thread: { id: string; name?: string | null };
  }) => <div data-testid="thread-card">{thread.name ?? thread.id}</div>,
}));

describe("ThreadsPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useThreadList.mockReset();
    useThreadSearch.mockReset();
    activeThreadListParams.mockReset();
    activeThreadListParams.mockReturnValue({
      archived: false,
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
    useThreadList.mockReturnValue({
      data: { data: [{ id: "thread-1", name: "First chat" }] },
      isLoading: false,
      isError: false,
    });
    useThreadSearch.mockReturnValue({
      data: { data: [{ thread: { id: "thread-2", name: "Search result" } }] },
      isLoading: false,
      isError: false,
    });
    useAppServerEvents.mockReturnValue({
      pendingServerRequests: {},
      threads: {},
    });
  });

  it("renders history and links to a new chat", async () => {
    const { ThreadsPage } = await import("./ThreadsPage");

    render(
      <MemoryRouter>
        <ThreadsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Threads" })).toBeTruthy();
    expect(screen.getByTestId("thread-card").textContent).toContain(
      "First chat",
    );
    expect(
      screen
        .getAllByRole("link", { name: /new chat/i })[0]
        ?.getAttribute("href"),
    ).toBe("/");
  });

  it("switches from the history list to server search results", async () => {
    const { ThreadsPage } = await import("./ThreadsPage");

    render(
      <MemoryRouter>
        <ThreadsPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Search chats" }), {
      target: { value: "Search" },
    });

    expect(useThreadSearch).toHaveBeenLastCalledWith("Search");
    expect(screen.getByTestId("thread-card").textContent).toContain(
      "Search result",
    );
    expect(screen.queryByText("First chat")).toBeNull();
  });

  it("shows an empty-state action when there are no threads", async () => {
    useThreadList.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
    const { ThreadsPage } = await import("./ThreadsPage");

    render(
      <MemoryRouter>
        <ThreadsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("No threads yet.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Start a chat" }).getAttribute("href"),
    ).toBe("/");
  });

  it("shows search errors instead of an empty-state message", async () => {
    useThreadSearch.mockReturnValue({
      data: undefined,
      error: new Error("Search unavailable"),
      isError: true,
      isLoading: false,
    });
    const { ThreadsPage } = await import("./ThreadsPage");

    render(
      <MemoryRouter>
        <ThreadsPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Search chats" }), {
      target: { value: "compiler" },
    });

    expect(screen.getByText(/Search unavailable/)).toBeTruthy();
    expect(screen.queryByText("No threads yet.")).toBeNull();
  });
});
