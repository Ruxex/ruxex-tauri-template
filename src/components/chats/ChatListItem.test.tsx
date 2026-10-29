// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ChatListItem } from "./ChatListItem";

describe("ChatListItem", () => {
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
    expect(chatLink.className).toContain("px-3");
    expect(chatLink.className).toContain("py-2");
    expect(chatLink.className).not.toContain("p-3");
    expect(screen.getByText("Running")).toBeTruthy();
    expect(screen.getByText("Project Alpha")).toBeTruthy();
    expect(screen.getByText("feature/sidebar")).toBeTruthy();
    expect(screen.queryByText(/Updated/)).toBeNull();
    expect(screen.queryByText("gpt-5")).toBeNull();
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
