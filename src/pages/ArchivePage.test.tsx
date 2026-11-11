// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useArchivedThreadList = vi.hoisted(() => vi.fn());
const useUnarchiveThread = vi.hoisted(() => vi.fn());
const useDeleteThread = vi.hoisted(() => vi.fn());
const useDeleteAllArchivedThreads = vi.hoisted(() => vi.fn());
const mutateAsync = vi.hoisted(() => vi.fn());
const deleteMutateAsync = vi.hoisted(() => vi.fn());
const deleteAllMutateAsync = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useArchivedThreadList,
  useDeleteAllArchivedThreads,
  useDeleteThread,
  useUnarchiveThread,
}));
vi.mock("../components/common/ThreadCard", () => ({
  ThreadCard: ({
    thread,
    actions,
    showUpdatedAt,
  }: {
    thread: { id: string; name?: string | null; updatedAt?: number };
    actions?: React.ReactNode;
    showUpdatedAt?: boolean;
  }) => (
    <article>
      <span>{thread.name ?? thread.id}</span>
      {showUpdatedAt && <span>{thread.updatedAt}</span>}
      {actions}
    </article>
  ),
}));

describe("ArchivePage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({});
    deleteMutateAsync.mockReset();
    deleteMutateAsync.mockResolvedValue({});
    deleteAllMutateAsync.mockReset();
    deleteAllMutateAsync.mockResolvedValue({});
    useDeleteThread.mockReturnValue({
      mutateAsync: deleteMutateAsync,
      isPending: false,
    });
    useDeleteAllArchivedThreads.mockReturnValue({
      mutateAsync: deleteAllMutateAsync,
      isPending: false,
    });
    useUnarchiveThread.mockReturnValue({ mutateAsync, isPending: false });
    useArchivedThreadList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        data: [
          { id: "thread-old", name: "Old chat", updatedAt: 1_735_689_600 },
        ],
        nextCursor: null,
      },
    });
  });

  it("renders archived chats with icon actions and last updated metadata", async () => {
    const { ArchivePage } = await import("./ArchivePage");

    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(screen.getByText("Old chat")).toBeTruthy();
    expect(screen.getByText("1735689600")).toBeTruthy();
    expect(mutateAsync).toHaveBeenCalledWith({ threadId: "thread-old" });
    expect(screen.queryByRole("link", { name: "Open" })).toBeNull();
    expect(screen.getByRole("button", { name: "Restore" }).textContent).toBe(
      "",
    );
    expect(screen.getByRole("button", { name: "Delete" }).textContent).toBe("");
    expect(screen.queryByText("History")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Delete all archived chats" }),
    ).toBeTruthy();
  });

  it("confirms before deleting every archived chat", async () => {
    const { ArchivePage } = await import("./ArchivePage");

    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete all archived chats" }),
    );
    expect(
      screen.getByRole("heading", { name: "Delete all archived chats?" }),
    ).toBeTruthy();
    expect(deleteAllMutateAsync).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete all permanently" }),
    );

    expect(deleteAllMutateAsync).toHaveBeenCalledWith();
  });

  it("paginates archived chats with opaque cursors", async () => {
    useArchivedThreadList.mockImplementation((cursor: string | null) => ({
      isLoading: false,
      isError: false,
      data:
        cursor === "cursor-next"
          ? { data: [{ id: "thread-new", name: "New chat" }], nextCursor: null }
          : {
              data: [{ id: "thread-old", name: "Old chat" }],
              nextCursor: "cursor-next",
            },
    }));
    const { ArchivePage } = await import("./ArchivePage");

    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("New chat")).toBeTruthy();
    expect(useArchivedThreadList).toHaveBeenLastCalledWith("cursor-next");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Old chat")).toBeTruthy();
  });

  it("confirms permanent deletion before sending the delete request", async () => {
    const { ArchivePage } = await import("./ArchivePage");

    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("heading", { name: "Delete chat?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(deleteMutateAsync).toHaveBeenCalledWith({ threadId: "thread-old" });
  });

  it("renders the empty state for an empty archive", async () => {
    useArchivedThreadList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [], nextCursor: null },
    });
    const { ArchivePage } = await import("./ArchivePage");

    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("No archived chats.")).toBeTruthy();
  });

  it("renders a stable error state when archive loading fails", async () => {
    useArchivedThreadList.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    });
    const { ArchivePage } = await import("./ArchivePage");

    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Unable to load archived chats.")).toBeTruthy();
  });
});
