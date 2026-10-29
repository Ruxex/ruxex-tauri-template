// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useUiPreferences = vi.hoisted(() => vi.fn());
const useThread = vi.hoisted(() => vi.fn());
const projectSidebarProps = vi.hoisted(() => vi.fn());

vi.mock("../../app/ui-preferences", () => ({ useUiPreferences }));
vi.mock("../../app-server/hooks", () => ({ useThread }));
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

  it("does not leave an overlay over the project page", () => {
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

  it("gives the chat route a full-height layout for a bottom composer", () => {
    useUiPreferences.mockReturnValue({
      preferences: { sidebarCollapsed: false },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    const section = screen.getByRole("main").querySelector("section");
    expect(section?.className).toContain("overflow-hidden");
    expect(section?.className).toContain("p-0");
  });
});
