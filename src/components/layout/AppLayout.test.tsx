// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useUiPreferences = vi.hoisted(() => vi.fn());
const useThread = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const useThreadReadState = vi.hoisted(() => vi.fn());
const markThreadRead = vi.hoisted(() => vi.fn());
const projectSidebarProps = vi.hoisted(() => vi.fn());

vi.mock("../../app/ui-preferences", () => ({ useUiPreferences }));
vi.mock("../../app/thread-read-state", () => ({ useThreadReadState }));
vi.mock("../../app-server/hooks", () => ({ useProject, useThread }));
vi.mock("../sidebar/ProjectSidebar", () => ({
  ProjectSidebar: (props: Record<string, unknown>) => {
    projectSidebarProps(props);
    return <aside data-testid="project-sidebar" />;
  },
}));

import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useThread.mockReturnValue({ data: undefined });
    useProject.mockReturnValue({ data: undefined });
    useThreadReadState.mockReturnValue({ markThreadRead });
    markThreadRead.mockReset();
    projectSidebarProps.mockReset();
  });

  it("does not render the removed context drawer", () => {
    useUiPreferences.mockReturnValue({
      preferences: {
        sidebarCollapsed: false,
      },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    const main = screen.getByRole("main");
    const navigation = screen.getByRole("navigation", {
      name: "Browser navigation",
    });

    expect(navigation.parentElement).toBe(main);
    expect(screen.getByTestId("project-sidebar").parentElement).not.toBe(
      navigation.parentElement,
    );
    expect(projectSidebarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showContextPanel: true }),
    );
    expect(screen.queryByTestId("context-drawer")).toBeNull();
  });

  it("closes the expanded sidebar with Escape", () => {
    const update = vi.fn();
    useUiPreferences.mockReturnValue({
      preferences: {
        sidebarCollapsed: false,
      },
      update,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(update).toHaveBeenCalledWith({ sidebarCollapsed: true });
  });

  it("does not show the sidebar overlay on the project page", () => {
    useUiPreferences.mockReturnValue({
      preferences: {
        sidebarCollapsed: false,
      },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "Close sidebar overlay" }),
    ).toBeNull();
  });

  it("keeps the navigation rail but hides the unrelated context panel on approvals", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/approvals"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(projectSidebarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showContextPanel: false }),
    );
    expect(
      screen.queryByRole("button", { name: "Close sidebar overlay" }),
    ).toBeNull();
    cleanup();
  });

  it.each(["/projects", "/projects/project-1"])(
    "keeps the left rail without a context panel on %s",
    (pathname) => {
      useUiPreferences.mockReturnValue({
        preferences: { sidebarCollapsed: false },
        update: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={[pathname]}>
          <AppLayout />
        </MemoryRouter>,
      );

      expect(screen.getByTestId("project-sidebar")).toBeTruthy();
      expect(projectSidebarProps).toHaveBeenLastCalledWith(
        expect.objectContaining({ showContextPanel: false }),
      );
      expect(
        screen.queryByRole("button", { name: "Close sidebar overlay" }),
      ).toBeNull();
      cleanup();
    },
  );

  it("keeps the settings context panel visible on the account page", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/settings/account"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(projectSidebarProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ showContextPanel: true }),
    );
  });

  it("uses the selected thread title in the shared navigation bar", () => {
    useThread.mockReturnValue({
      data: {
        thread: { name: "Command demo", preview: "fallback" },
      },
    });
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("Command demo")).toBeTruthy();
  });

  it("marks the selected chat read at its current update position", () => {
    useThread.mockReturnValue({
      data: {
        thread: {
          id: "thread-1",
          name: "Command demo",
          preview: "fallback",
          updatedAt: 42,
        },
      },
    });
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <Routes>
          <Route path="/chat/:threadId" element={<AppLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(markThreadRead).toHaveBeenCalledWith("thread-1", 42);
  });

  it("does not mark a thread read outside a chat route", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(markThreadRead).not.toHaveBeenCalled();
  });

  it("uses the selected project name in the shared navigation bar", () => {
    useProject.mockReturnValue({
      data: { project: { name: "Ruxex" } },
    });
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/projects/project-1"]}>
        <Routes>
          <Route path="/projects/:projectId" element={<AppLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(useProject).toHaveBeenCalledWith("project-1");
    expect(screen.getByText("Ruxex")).toBeTruthy();
  });

  it("keeps the chat chrome fixed while the three-column content section scrolls", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("chat-content-container").className).toContain(
      "@container/chat",
    );

    const main = screen.getByRole("main");
    const section = main.querySelector("section");
    const contentRow = main.children[1];

    expect(main.className).toContain("h-dvh");
    expect(main.className).toContain("overflow-hidden");
    expect(main.className).not.toContain("overflow-y-auto");
    expect(contentRow?.className).toContain("min-h-0");
    expect(section?.className).toContain("min-h-0");
    expect(section?.className).toContain("overflow-y-auto");
    expect(section?.className).not.toContain("max-w-[1440px]");
    expect(section?.className).toContain("p-0");
    expect(section?.getAttribute("data-chat-font-size")).toBeNull();
    expect(main.getAttribute("data-conversation-scroll")).toBeNull();
    expect(section?.getAttribute("data-conversation-scroll")).toBe("true");
  });

  it("opens an empty right pane inside the resizable panel group", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    const group = screen.getByTestId("pane-resizable-group");
    expect(group.className).toContain("flex");
    const pane = screen.getByTestId("right-pane");
    expect(pane.className).toContain("transition");
    expect(
      screen.getByTestId("right-pane-panel").getAttribute("data-pane-open"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Open right pane" }));

    expect(
      screen.getByTestId("right-pane-panel").getAttribute("data-pane-open"),
    ).toBe("true");
    expect(
      screen.getByRole("separator", { name: "Resize right pane" }),
    ).toBeTruthy();
    expect(pane.textContent).toBe("");
    expect(group.className).toContain("flex");
    expect(screen.getByRole("button", { name: "Close right pane" })).toBeTruthy();
  });

  it("configures the right pane max size at 1536 pixels", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open right pane" }));
    expect(
      screen.getByTestId("right-pane-panel").getAttribute("data-max-size"),
    ).toBe("1536");
  });
});
