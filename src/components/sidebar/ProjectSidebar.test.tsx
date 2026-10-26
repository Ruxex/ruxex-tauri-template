// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useProjectList = vi.hoisted(() => vi.fn());
const useThreadList = vi.hoisted(() => vi.fn());
const usePluginList = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useProjectList,
  useThreadList,
  usePluginList,
}));

describe("ProjectSidebar", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useProjectList.mockReturnValue({
      data: { data: [{ id: "project-1", name: "Project Alpha" }] },
      isLoading: false,
      isError: false,
    });
    useThreadList.mockReturnValue({
      data: {
        data: [
          {
            id: "thread-1",
            model: "gpt-5",
            name: "Build the sidebar",
            preview: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    usePluginList.mockReturnValue({
      data: {
        marketplaces: [
          {
            name: "official",
            plugins: [
              {
                id: "lint",
                name: "Lint tools",
                installed: true,
                enabled: true,
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
  });

  it("renders the home context panel beside the icon rail", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="home"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const panel = screen.getByRole("complementary", {
      name: "Home sidebar",
    });

    expect(panel.querySelector('a[href="/chat/new"]')).toBeTruthy();
    const projectsSection = within(panel)
      .getByText("Projects")
      .closest("details");
    expect(projectsSection?.open).toBe(true);

    fireEvent.click(projectsSection?.querySelector("summary") as HTMLElement);

    expect(projectsSection?.open).toBe(false);
    fireEvent.click(projectsSection?.querySelector("summary") as HTMLElement);
    expect(projectsSection?.open).toBe(true);

    const project = within(panel).getByText("Project Alpha");
    const projectGroup = project.closest("details");
    expect(projectGroup?.open).toBe(false);

    fireEvent.click(project);

    expect(projectGroup?.open).toBe(true);
    expect(
      within(projectGroup as HTMLElement).getByRole("link", {
        name: /Build the sidebar/,
      }),
    ).toBeTruthy();

    const recentChatsSection = within(panel)
      .getByText("Recent chats")
      .closest("details");
    expect(recentChatsSection?.open).toBe(true);

    fireEvent.click(
      recentChatsSection?.querySelector("summary") as HTMLElement,
    );

    expect(recentChatsSection?.open).toBe(false);
  });

  it("does not mount a context panel for projects", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="projects"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("complementary", { name: "Projects sidebar" }),
    ).toBeNull();
  });

  it("renders plugin and skill navigation with collapsed installed plugins", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="plugins"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const panel = screen.getByRole("complementary", {
      name: "Plugins sidebar",
    });
    expect(within(panel).getByRole("button", { name: "Plugins" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Skills" })).toBeTruthy();

    const installed = within(panel).getByText("Installed").closest("details");
    expect(installed?.open).toBe(false);
    fireEvent.click(installed?.querySelector("summary") as HTMLElement);
    expect(installed?.open).toBe(true);
    expect(
      within(installed as HTMLElement).getByText("Lint tools"),
    ).toBeTruthy();
  });

  it("keeps the rail and context panel bounded to the viewport", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="home"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Workspace sidebar",
    });

    expect(sidebar.className).toContain("h-full");
    expect(sidebar.className).toContain("min-h-0");
  });

  it("keeps navigation links accessible when the pane is collapsed", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="home"
          collapsed
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rail = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });
    expect(
      within(rail).queryByRole("link", { name: "Ruxex Desktop home" }),
    ).toBeNull();
    expect(within(rail).getByRole("button", { name: "Home" })).toBeTruthy();
    expect(within(rail).getByRole("button", { name: "Projects" })).toBeTruthy();
  });

  it("renders Heroicons in the icon rail", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="home"
          collapsed
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rail = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });

    expect(
      within(rail).getByRole("button", { name: "Home" }).querySelector("svg"),
    ).toBeTruthy();
  });

  it("orders account immediately above settings", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="home"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rail = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });

    expect(
      within(rail)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Home",
      "Projects",
      "Plugins",
      "Automation",
      "Account",
      "Settings",
    ]);

    const secondaryNavigation = within(rail).getByTestId(
      "secondary-navigation",
    );
    expect(
      within(secondaryNavigation)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Account", "Settings"]);
  });

  it("uses an icon rail to switch the visible sidebar panel", async () => {
    const onPanelChange = vi.fn();
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="home"
          collapsed={false}
          onPanelChange={onPanelChange}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rail = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });
    expect(within(rail).getByRole("button", { name: "Home" })).toBeTruthy();
    expect(within(rail).getByRole("button", { name: "Settings" })).toBeTruthy();

    fireEvent.click(within(rail).getByRole("button", { name: "Settings" }));

    expect(onPanelChange).toHaveBeenCalledWith("settings");
  });

  it("shows settings tabs in the settings sidebar panel", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <ProjectSidebar
          activePanel="settings"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const panel = screen.getByRole("complementary", {
      name: "Settings sidebar",
    });
    expect(within(panel).getByRole("link", { name: "General" })).toBeTruthy();
    expect(
      within(panel).getByRole("link", { name: "Appearance" }),
    ).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Models" })).toBeTruthy();
    expect(within(panel).queryByRole("link", { name: "Account" })).toBeNull();
  });
});
