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

  it("gives compact project chats a visible card boundary", async () => {
    const { ThreadCard } = await import("./ThreadCard");

    render(
      <MemoryRouter>
        <ThreadCard
          compact
          thread={{
            id: "thread-1",
            name: "Project chat",
            preview: "Project preview",
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const chatLink = screen.getByRole("link", {
      name: /Project chatProject preview/,
    });
    const card = chatLink.closest("article");
    expect(card).toBeTruthy();
    expect(card?.className).toContain("border-base-300");
    expect(card?.className).toContain("bg-base-100");
  });
});
