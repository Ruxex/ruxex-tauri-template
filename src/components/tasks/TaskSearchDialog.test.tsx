// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useThreadSearch = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({ useThreadSearch }));

describe("TaskSearchDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useThreadSearch.mockReset();
    useThreadSearch.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: false,
    });
  });

  it("searches task titles and selects a result", async () => {
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
    const onSelect = vi.fn();
    const { TaskSearchDialog } = await import("./TaskSearchDialog");

    render(
      <MemoryRouter>
        <TaskSearchDialog onClose={vi.fn()} onSelect={onSelect} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: "compiler" },
    });

    expect(useThreadSearch).toHaveBeenLastCalledWith("compiler");
    fireEvent.click(screen.getByRole("link", { name: /Fix the compiler/ }));
    expect(onSelect).toHaveBeenCalledWith("thread-1");
  });

  it("shows blank, loading, error, and empty states and closes on Escape", async () => {
    const onClose = vi.fn();
    const { TaskSearchDialog } = await import("./TaskSearchDialog");
    render(
      <MemoryRouter>
        <TaskSearchDialog onClose={onClose} onSelect={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Type to search tasks.")).toBeTruthy();
    useThreadSearch.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      error: new Error("Search unavailable"),
    });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tasks" }), {
      target: { value: "compiler" },
    });
    expect(screen.getByRole("dialog").textContent).toContain(
      "Search unavailable",
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
