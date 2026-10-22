// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const useUiPreferences = vi.hoisted(() => vi.fn());
const projectSidebarProps = vi.hoisted(() => vi.fn());

vi.mock("../../app/ui-preferences", () => ({ useUiPreferences }));
vi.mock("../context/ContextDrawer", () => ({
  ContextDrawer: () => <aside data-testid="context-drawer" />,
}));
vi.mock("../sidebar/ProjectSidebar", () => ({
  ProjectSidebar: (props: { contextPanelHidden?: boolean }) => {
    projectSidebarProps(props);
    return <aside data-testid="project-sidebar" />;
  },
}));

import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  afterEach(cleanup);

  it("places browser navigation above all workspace panes", () => {
    useUiPreferences.mockReturnValue({
      preferences: {
        contextDrawerOpen: true,
        contextTab: "context",
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
    expect(screen.getByTestId("context-drawer")).toBeTruthy();
  });

  it("hides the context sidebar on project pages", () => {
    useUiPreferences.mockReturnValue({
      preferences: {
        contextDrawerOpen: false,
        contextTab: "context",
        sidebarCollapsed: false,
      },
      update: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/projects"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(projectSidebarProps).toHaveBeenCalledWith(
      expect.objectContaining({ contextPanelHidden: true }),
    );
  });
});
