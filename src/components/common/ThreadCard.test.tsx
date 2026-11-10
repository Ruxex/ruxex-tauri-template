// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents: () => ({ threads: {}, pendingServerRequests: {} }),
}));

describe("ThreadCard", () => {
  afterEach(cleanup);

  it("passes custom actions to the shared chat row", async () => {
    const onRestore = vi.fn();
    const { ThreadCard } = await import("./ThreadCard");

    render(
      <MemoryRouter>
        <ThreadCard
          actions={
            <button type="button" onClick={onRestore}>
              Restore
            </button>
          }
          thread={{
            id: "thread-1",
            name: "Archived chat",
            preview: "Archived preview",
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const restoreButton = screen.getByRole("button", { name: "Restore" });
    expect(restoreButton.closest("a")).toBeNull();
    fireEvent.click(restoreButton);
    expect(onRestore).toHaveBeenCalledOnce();
  });
});
