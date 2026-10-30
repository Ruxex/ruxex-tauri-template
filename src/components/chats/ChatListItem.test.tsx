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

import { ChatListItem } from "./ChatListItem";

describe("ChatListItem", () => {
  let triggerResize: (() => void) | undefined;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          triggerResize = () => callback([], this as unknown as ResizeObserver);
        }

        disconnect() {}

        observe() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    triggerResize = undefined;
  });

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

  it("truncates long chat titles without moving the status icon", () => {
    const title =
      "A very long chat title that should stay inside the sidebar width";

    render(
      <MemoryRouter>
        <ChatListItem
          status="completed"
          thread={{
            id: "thread-long-title",
            name: title,
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const titleElement = screen.getByText(title);
    const titleRegion = titleElement.parentElement as HTMLElement;
    expect(titleRegion.className).toContain("min-w-0");
    expect(titleRegion.className).toContain("flex-1");
    expect(titleElement.className).toContain("truncate");
    expect(
      screen.getByRole("status", { name: "Chat status: Completed" }),
    ).toBeTruthy();
  });

  it("renders an archive action without nesting it in the chat link", () => {
    const onArchive = vi.fn();
    const onClick = vi.fn();

    render(
      <MemoryRouter>
        <ChatListItem
          onArchive={onArchive}
          onClick={onClick}
          thread={{
            id: "thread-1",
            name: "Build the sidebar",
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const archiveButton = screen.getByRole("button", {
      name: "Archive Build the sidebar",
    });
    const row = archiveButton.parentElement;
    expect(row?.className).toContain("group/thread");
    expect(archiveButton.className).toContain("group-hover/thread:opacity-100");
    expect(archiveButton.querySelector("svg")).toBeTruthy();
    expect(archiveButton.closest("a")).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/chat/thread-1",
    );

    fireEvent.click(archiveButton);

    expect(onArchive).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disables the archive action while archiving", () => {
    render(
      <MemoryRouter>
        <ChatListItem
          isArchiving
          onArchive={vi.fn()}
          thread={{
            id: "thread-1",
            name: "Build the sidebar",
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole("button", { name: "Archive Build the sidebar" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("keeps the title and archive action inside the sidebar row", () => {
    const title =
      "A very long title that must shrink before the archive action";

    render(
      <MemoryRouter>
        <ChatListItem
          onArchive={vi.fn()}
          thread={{
            id: "thread-long-title",
            name: title,
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const archiveButton = screen.getByRole("button", {
      name: `Archive ${title}`,
    });
    const row = archiveButton.parentElement;
    const chatLink = screen.getByRole("link");

    expect(row?.className).toContain("w-full");
    expect(row?.className).toContain("max-w-full");
    expect(row?.className).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(row?.className).toContain("overflow-hidden");
    expect(row?.className).toContain("p-0");
    expect(row?.className).toContain("hover:border-primary/50");
    expect(row?.className).toContain("hover:bg-base-200");
    expect(chatLink.className).toContain("max-w-full");
    expect(chatLink.className).toContain("h-full");
    expect(chatLink.className).not.toContain("hover:border-primary/50");
  });

  it("only slides an overflowing title on hover", () => {
    const title = "A title that is long enough to overflow the sidebar";

    render(
      <MemoryRouter>
        <ChatListItem
          thread={{
            id: "thread-long-title",
            name: title,
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const titleText = screen.getByText(title);
    const titleRegion = titleText.parentElement as HTMLElement;
    expect(titleRegion.getAttribute("title")).toBeNull();
    expect(titleText).toBeTruthy();
    Object.defineProperty(titleRegion, "clientWidth", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(titleText, "scrollWidth", {
      configurable: true,
      value: 220,
    });
    act(() => triggerResize?.());

    expect(titleRegion.getAttribute("data-title-overflowing")).toBe("true");
    const marquee = titleRegion.querySelector<HTMLElement>(
      "[data-title-marquee]",
    );
    expect(marquee).toBeTruthy();
    fireEvent.mouseEnter(titleRegion);
    expect(marquee?.className).toContain("transition-transform");
    expect(marquee?.style.transform).toBe("translateX(-120px)");
    expect(marquee?.style.transitionDelay).toBe("200ms");
    expect(marquee?.style.transitionDuration).toBe("4500ms");
    expect(marquee?.className).toContain("ease-linear");
    expect(titleText?.className).toContain("opacity-0");
    expect(marquee?.textContent).toBe(title);

    fireEvent.mouseLeave(titleRegion);
    expect(marquee?.style.transform).toBe("translateX(0px)");
  });

  it("does not animate a title that fits the available width", () => {
    const title = "Short title";

    render(
      <MemoryRouter>
        <ChatListItem
          thread={{
            id: "thread-short-title",
            name: title,
            preview: null,
            updatedAt: 1_735_689_600,
          }}
        />
      </MemoryRouter>,
    );

    const titleText = screen.getByText(title);
    const titleRegion = titleText.parentElement as HTMLElement;
    Object.defineProperty(titleRegion, "clientWidth", {
      configurable: true,
      value: 220,
    });
    Object.defineProperty(titleText, "scrollWidth", {
      configurable: true,
      value: 80,
    });
    act(() => triggerResize?.());
    fireEvent.mouseEnter(titleRegion);

    expect(titleRegion.getAttribute("data-title-overflowing")).toBe("false");
    const marquee = titleRegion.querySelector<HTMLElement>(
      "[data-title-marquee]",
    );
    expect(marquee).toBeNull();
  });
});
