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

vi.mock("../../app-server/hooks", () => ({
  useProjectList,
  useThreadList,
}));

describe("ProjectSidebar", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useProjectList.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
    useThreadList.mockReturnValue({
      data: { data: [] },
      isLoading: false,
      isError: false,
    });
  });

  it("renders the chats context panel beside the icon rail", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="chats"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const panel = screen.getByRole("complementary", {
      name: "Chats sidebar",
    });

    expect(panel.querySelector('a[href="/chat/new"]')).toBeTruthy();
    expect(within(panel).getByText("Projects")).toBeTruthy();
    expect(within(panel).getByText("Recent chats")).toBeTruthy();
  });

  it("keeps the rail and context panel bounded to the viewport", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="chats"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Workspace sidebar",
    });

    expect(sidebar.className).toContain("h-dvh");
    expect(sidebar.className).toContain("min-h-0");
  });

  it("keeps navigation links accessible when the pane is collapsed", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="chats"
          collapsed
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rail = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });
    expect(within(rail).getByRole("button", { name: "Chats" })).toBeTruthy();
    expect(within(rail).getByRole("button", { name: "New chat" })).toBeTruthy();
  });

  it("keeps settings separate from the primary navigation at the bottom", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="chats"
          collapsed={false}
          onPanelChange={vi.fn()}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rail = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });

    expect(within(rail).getByRole("button", { name: "Settings" })).toBeTruthy();
    expect(
      screen.queryByRole("complementary", { name: "Chats sidebar" }),
    ).toBeTruthy();
  });

  it("uses an icon rail to switch the visible sidebar panel", async () => {
    const onPanelChange = vi.fn();
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar
          activePanel="chats"
          collapsed={false}
          onPanelChange={onPanelChange}
          onToggle={vi.fn()}
        />
      </MemoryRouter>,
    );

    const rail = screen.getByRole("navigation", {
      name: "Workspace navigation",
    });
    expect(within(rail).getByRole("button", { name: "Chats" })).toBeTruthy();
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
    expect(within(panel).getByRole("link", { name: "Account" })).toBeTruthy();
  });
});
