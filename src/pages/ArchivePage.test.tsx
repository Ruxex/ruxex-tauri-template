// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useArchivedThreadList = vi.hoisted(() => vi.fn());
const useUnarchiveThread = vi.hoisted(() => vi.fn());
const mutateAsync = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useArchivedThreadList,
  useUnarchiveThread,
}));
vi.mock("../components/common/ThreadCard", () => ({
  ThreadCard: ({
    thread,
    actions,
  }: {
    thread: { id: string; name?: string | null };
    actions?: React.ReactNode;
  }) => (
    <article>
      <span>{thread.name ?? thread.id}</span>
      {actions}
    </article>
  ),
}));

describe("ArchivePage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({});
    useUnarchiveThread.mockReturnValue({ mutateAsync, isPending: false });
    useArchivedThreadList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [{ id: "thread-old", name: "Old chat" }] },
    });
  });

  it("renders archived chats with restore and open actions", async () => {
    const { ArchivePage } = await import("./ArchivePage");

    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));

    expect(screen.getByText("Old chat")).toBeTruthy();
    expect(mutateAsync).toHaveBeenCalledWith({ threadId: "thread-old" });
    expect(
      screen.getByRole("link", { name: "Open" }).getAttribute("href"),
    ).toBe("/chat/thread-old");
  });

  it("renders the empty state for an empty archive", async () => {
    useArchivedThreadList.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { data: [] },
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
