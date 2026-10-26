// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const useUiPreferences = vi.hoisted(() => vi.fn());
const projectSidebarProps = vi.hoisted(() => vi.fn());

vi.mock("../../app/ui-preferences", () => ({ useUiPreferences }));
vi.mock("../sidebar/ProjectSidebar", () => ({
  ProjectSidebar: (props: Record<string, unknown>) => {
    projectSidebarProps(props);
    return <aside data-testid="project-sidebar" />;
  },
}));

import { AppLayout } from "./AppLayout";

describe("AppLayout", () => {
  afterEach(cleanup);

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
});
