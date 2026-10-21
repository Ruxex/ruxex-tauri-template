// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
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

  it("renders the primary navigation in the left pane", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar collapsed={false} onToggle={vi.fn()} />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });

    expect(navigation.querySelector('a[href="/threads"]')).toBeTruthy();
    expect(navigation.querySelector('a[href="/chat/new"]')).toBeTruthy();
    expect(navigation.querySelector('a[href="/approvals"]')).toBeTruthy();
    expect(navigation.querySelector('a[href="/capabilities"]')).toBeTruthy();
    expect(navigation.querySelector('a[href="/schedules"]')).toBeTruthy();
  });

  it("keeps navigation links accessible when the pane is collapsed", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar collapsed onToggle={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Threads" }).getAttribute("href"),
    ).toBe("/threads");
    expect(
      screen.getByRole("link", { name: "New chat" }).getAttribute("href"),
    ).toBe("/chat/new");
  });

  it("keeps settings separate from the primary navigation at the bottom", async () => {
    const { ProjectSidebar } = await import("./ProjectSidebar");

    render(
      <MemoryRouter>
        <ProjectSidebar collapsed={false} onToggle={vi.fn()} />
      </MemoryRouter>,
    );

    const primaryNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const settingsNavigation = screen.getByRole("navigation", {
      name: "Settings navigation",
    });

    expect(
      within(primaryNavigation).queryByRole("link", { name: "Account" }),
    ).toBeNull();
    expect(
      within(primaryNavigation).queryByRole("link", { name: "Settings" }),
    ).toBeNull();
    expect(
      within(settingsNavigation)
        .getByRole("link", { name: "Settings" })
        .getAttribute("href"),
    ).toBe("/settings");
  });
});
