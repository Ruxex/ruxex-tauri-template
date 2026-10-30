// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ChatListItem } from "./ChatListItem";

describe("ChatListItem", () => {
  afterEach(cleanup);

  it("renders chat context without exposing model or provider details", () => {
    render(
      <MemoryRouter>
        <ChatListItem
          status="running"
          projectName="Project Alpha"
          worktreeLabel="feature/sidebar"
          thread={{
            id: "thread-1",
            model: "gpt-5",
            name: "Build the sidebar",
            preview: "Implement the sidebar",
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const chatLink = screen.getByRole("link", { name: /Build the sidebar/ });
    expect(chatLink.getAttribute("href")).toBe("/chat/thread-1");
    expect(chatLink.className).toContain("px-2");
    expect(chatLink.className).toContain("py-1");
    expect(chatLink.className).not.toContain("p-3");
    expect(
      screen.getByRole("status", { name: "Chat status: Running" }),
    ).toBeTruthy();
    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.getByText("Project Alpha")).toBeTruthy();
    expect(screen.getByText("feature/sidebar")).toBeTruthy();
    expect(screen.queryByText(/Updated/)).toBeNull();
    expect(screen.queryByText("gpt-5")).toBeNull();
  });

  it.each([
    ["running", "Running"],
    ["completed", "Completed"],
    ["waiting", "Waiting"],
    ["failed", "Failed"],
    ["stopped", "Stopped"],
  ] as const)("renders %s as an icon status", (status, label) => {
    const { unmount } = render(
      <MemoryRouter>
        <ChatListItem
          status={status}
          thread={{
            id: `thread-${status}`,
            name: "Build the sidebar",
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const statusIcon = screen.getByRole("status", {
      name: `Chat status: ${label}`,
    });
    expect(statusIcon).toBeTruthy();
    expect(screen.queryByText(label)).toBeNull();
    if (status === "completed") {
      expect(statusIcon.className).toContain("text-success");
    }
    if (status === "running") {
      expect(statusIcon.querySelector(".loading-spinner")).toBeTruthy();
    } else {
      expect(statusIcon.querySelector("svg")).toBeTruthy();
    }

    unmount();
  });

  it("does not render a status region when the chat has no status", () => {
    render(
      <MemoryRouter>
        <ChatListItem
          thread={{
            id: "thread-1",
            name: "Build the sidebar",
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Build the sidebar")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("falls back to the preview or an untitled label", () => {
    const { rerender } = render(
      <MemoryRouter>
        <ChatListItem
          thread={{
            id: "thread-1",
            name: null,
            preview: "Inspect the repository",
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Inspect the repository")).toBeTruthy();

    rerender(
      <MemoryRouter>
        <ChatListItem
          thread={{
            id: "thread-2",
            name: null,
            preview: "",
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Untitled chat")).toBeTruthy();
  });
});
