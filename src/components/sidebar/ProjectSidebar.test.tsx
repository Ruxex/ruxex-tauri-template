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
const useThreadActivity = vi.hoisted(() => vi.fn());
const useThreadReadState = vi.hoisted(() => vi.fn());
const useArchiveThread = vi.hoisted(() => vi.fn());
const useThreadSearch = vi.hoisted(() =>
  vi.fn(() => ({ data: undefined, isError: false, isLoading: false })),
);
const usePluginList = vi.hoisted(() => vi.fn());
const activeThreadListParams = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useProjectList,
  useThreadList,
  useThreadActivity,
  useArchiveThread,
  useThreadSearch,
  activeThreadListParams,
  usePluginList,
}));
vi.mock("../../app/thread-read-state", () => ({ useThreadReadState }));

describe("ProjectSidebar", () => {
  afterEach(cleanup);

  beforeEach(() => {
    activeThreadListParams.mockReturnValue({
      archived: false,
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
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
            status: {
              type: "active",
              activeFlags: ["waitingOnApproval"],
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useThreadActivity.mockReturnValue({
      status: undefined,
      waitingForRequest: false,
    });
    useThreadReadState.mockReturnValue({
      isThreadUnread: vi.fn(() => false),
    });
    useArchiveThread.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
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

  it("renders the shared chat panel beside the icon rail on the home route", async () => {
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

    const panel = screen.getByRole("complementary", { name: "Chat sidebar" });

    expect(
      screen.getByRole("complementary", { name: "Workspace sidebar" })
        .className,
    ).toContain("w-[20rem]");
    expect(panel.querySelector('a[href="/"]')).toBeTruthy();
    expect(within(panel).getByText("Recent chats")).toBeTruthy();
    expect(within(panel).getByText("Projects")).toBeTruthy();
    expect(within(panel).queryByText("Home")).toBeNull();
    expect(
      within(panel).getByRole("button", { name: "Expand Project Alpha" }),
    ).toBeTruthy();
    expect(
      within(panel).queryByRole("link", { name: /Project Alpha/ }),
    ).toBeNull();
    expect(within(panel).queryByRole("link", { name: "Settings" })).toBeNull();
    expect(
      within(panel).getByRole("link", { name: /Build the sidebar/ }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("status", { name: "Chat status: Waiting" }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("button", {
        name: "Archive Build the sidebar",
      }),
    ).toBeTruthy();
    expect(within(panel).queryByText("gpt-5")).toBeNull();
    expect(useThreadList).toHaveBeenCalledWith({
      archived: false,
      limit: 50,
      sortKey: "recency_at",
      sortDirection: "desc",
    });
  });

  it("does not render an in-panel close button for the shared chat panel", async () => {
    const onToggle = vi.fn();
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <ProjectSidebar
          activePanel="home"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={onToggle}
        />
      </MemoryRouter>,
    );

    const panel = screen.getByRole("complementary", { name: "Chat sidebar" });
    expect(
      within(panel).queryByRole("button", { name: "Close sidebar panel" }),
    ).toBeNull();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("renders the shared chat panel for projects", async () => {
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

    const panel = screen.getByRole("complementary", {
      name: "Chat sidebar",
    });
    expect(
      screen.getByRole("complementary", { name: "Workspace sidebar" })
        .className,
    ).not.toContain("workbench-sidebar-collapsed");
    expect(within(panel).getByText("Recent chats")).toBeTruthy();
    expect(within(panel).getByText("Projects")).toBeTruthy();
    expect(
      within(panel).getByRole("button", { name: "Expand Project Alpha" }),
    ).toBeTruthy();
    expect(
      within(panel).queryByRole("link", { name: /Project Alpha/ }),
    ).toBeNull();
    expect(
      within(panel).getByRole("link", { name: /Build the sidebar/ }),
    ).toBeTruthy();
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
      name: "Capabilities sidebar",
    });
    expect(within(panel).getByRole("button", { name: "Plugins" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Skills" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "MCP" })).toBeTruthy();

    const installed = within(panel)
      .getByText("Installed (1)")
      .closest("details");
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

  it("renders above the conversation minimap when their areas overlap", async () => {
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

    expect(
      screen.getByRole("complementary", { name: "Workspace sidebar" })
        .className,
    ).not.toContain("z-40");
  });

  it("keeps only the compact rail when the context panel is disabled", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="projects"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
          showContextPanel={false}
        />
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Workspace sidebar",
    });

    expect(
      screen.getByRole("navigation", { name: "Workspace navigation" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("complementary", { name: "Chat sidebar" }),
    ).toBeNull();
    expect(sidebar.className).toContain("workbench-sidebar-collapsed");
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
    expect(
      within(panel).getByRole("link", { name: "General" }).className,
    ).toContain("text-base-content");
    expect(
      within(panel).getByRole("link", { name: "Appearance" }),
    ).toBeTruthy();
    expect(
      within(panel).getByRole("link", { name: "Models / Engines" }),
    ).toBeTruthy();
    expect(within(panel).getByRole("link", { name: "Account" })).toBeTruthy();
  });
});
