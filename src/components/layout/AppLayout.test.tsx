// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useUiPreferences = vi.hoisted(() => vi.fn());
const useThread = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const projectSidebarProps = vi.hoisted(() => vi.fn());

vi.mock("../../app/ui-preferences", () => ({ useUiPreferences }));
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
    expect(screen.queryByTestId("context-drawer")).toBeNull();
  });

  it("does not pass a context-panel visibility flag on project pages", () => {
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

    expect(projectSidebarProps.mock.calls[0]?.[0]).not.toHaveProperty(
      "contextPanelHidden",
    );
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

  it("shows the sidebar overlay on the project page", () => {
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
      screen.getByRole("button", { name: "Close sidebar overlay" }),
    ).toBeTruthy();
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

  it("keeps the chat chrome fixed while the content section scrolls", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <AppLayout />
      </MemoryRouter>,
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
    expect(section?.className).toContain("p-0");
    expect(section?.getAttribute("data-chat-font-size")).toBeNull();
    expect(main.getAttribute("data-conversation-scroll")).toBeNull();
    expect(section?.getAttribute("data-conversation-scroll")).toBe("true");
  });
});
