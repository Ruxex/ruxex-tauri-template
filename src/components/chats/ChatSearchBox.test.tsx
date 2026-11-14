// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useThreadSearch = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({ useThreadSearch }));

describe("ChatSearchBox", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    useThreadSearch.mockReset();
    useThreadSearch.mockImplementation((term: string) => ({
      data: term
        ? {
            data: [
              {
                snippet: "Fix the compiler",
                thread: {
                  id: "thread-1",
                  name: "Fix the compiler",
                  preview: "Fix the compiler error",
                  updatedAt: 1,
                },
              },
            ],
          }
        : undefined,
      isError: false,
      isLoading: false,
    }));
  });

  it("keeps search input in the sidebar and waits 400ms after typing", async () => {
    const { ChatSearchBox } = await import("./ChatSearchBox");

    render(
      <MemoryRouter>
        <ChatSearchBox onSelect={vi.fn()} />
      </MemoryRouter>,
    );

    const input = screen.getByRole("searchbox", { name: "Search chats" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useThreadSearch).toHaveBeenLastCalledWith("", {
      archived: false,
      limit: 8,
    });

    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "co" } });
    fireEvent.change(input, { target: { value: "compiler" } });

    expect(useThreadSearch).toHaveBeenLastCalledWith("", {
      archived: false,
      limit: 8,
    });
    await act(async () => {
      vi.advanceTimersByTime(399);
    });
    expect(useThreadSearch).toHaveBeenLastCalledWith("", {
      archived: false,
      limit: 8,
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(useThreadSearch).toHaveBeenLastCalledWith("compiler", {
      archived: false,
      limit: 8,
    });
    expect(screen.getByRole("link", { name: /Fix the compiler/ })).toBeTruthy();
  });
});
