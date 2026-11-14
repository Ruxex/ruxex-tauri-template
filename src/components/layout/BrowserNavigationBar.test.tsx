// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserNavigationBar } from "./BrowserNavigationBar";

function LocationProbe() {
  const location = useLocation();

  return <output data-testid="location">{location.pathname}</output>;
}

describe("BrowserNavigationBar", () => {
  afterEach(cleanup);

  it("moves backward and forward through browser history", () => {
    render(
      <MemoryRouter initialEntries={["/home", "/settings"]} initialIndex={1}>
        <BrowserNavigationBar />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("location").textContent).toBe("/home");

    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(screen.getByTestId("location").textContent).toBe("/settings");
  });

  it("uses a compact, subdued visual treatment", () => {
    render(
      <MemoryRouter>
        <BrowserNavigationBar />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Browser navigation",
    });
    expect(navigation.className).toContain("h-8");
    expect(navigation.className).toContain("bg-base-200/70");
    expect(navigation.className).toContain("text-base-content/60");
    expect(screen.getByRole("button", { name: "Back" }).className).toContain(
      "btn-xs",
    );
  });

  it("toggles the right pane from the global header", () => {
    const onToggleRightPane = vi.fn();
    render(
      <MemoryRouter>
        <BrowserNavigationBar
          onToggleRightPane={onToggleRightPane}
          rightPaneOpen={false}
        />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: "Open right pane" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(onToggleRightPane).toHaveBeenCalledOnce();
  });

  it("toggles the left sidebar from the global header", () => {
    const onToggleSidebar = vi.fn();
    render(
      <MemoryRouter>
        <BrowserNavigationBar
          onToggleSidebar={onToggleSidebar}
          sidebarOpen={false}
        />
      </MemoryRouter>,
    );

    const button = screen.getByRole("button", { name: "Open sidebar" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(onToggleSidebar).toHaveBeenCalledOnce();
  });

  it("removes the sidebar-sized gap before breadcrumbs while collapsed", () => {
    render(
      <MemoryRouter>
        <BrowserNavigationBar onToggleSidebar={vi.fn()} sidebarOpen={false} />
      </MemoryRouter>,
    );

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb.className).toContain("pl-0");
    expect(breadcrumb.previousElementSibling?.className).toContain("w-auto");
  });

  it("uses directional rectangle icons for pane toggles", () => {
    const { rerender } = render(
      <MemoryRouter>
        <BrowserNavigationBar
          onToggleRightPane={vi.fn()}
          onToggleSidebar={vi.fn()}
          rightPaneOpen={false}
          sidebarOpen={false}
        />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole("button", { name: "Open sidebar" })
        .querySelector("path")
        ?.getAttribute("d"),
    ).toBe(
      "M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9",
    );
    expect(
      screen
        .getByRole("button", { name: "Open right pane" })
        .querySelector("path")
        ?.getAttribute("d"),
    ).toBe(
      "M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15",
    );

    rerender(
      <MemoryRouter>
        <BrowserNavigationBar
          onToggleRightPane={vi.fn()}
          onToggleSidebar={vi.fn()}
          rightPaneOpen
          sidebarOpen
        />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole("button", { name: "Close sidebar" })
        .querySelector("path")
        ?.getAttribute("d"),
    ).toBe(
      "M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15",
    );
    expect(
      screen
        .getByRole("button", { name: "Close right pane" })
        .querySelector("path")
        ?.getAttribute("d"),
    ).toBe(
      "M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9",
    );
  });

  it("renders breadcrumbs for the current route", () => {
    render(
      <MemoryRouter initialEntries={["/settings/appearance"]}>
        <BrowserNavigationBar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
  });

  it("renders the archived chats settings breadcrumb", () => {
    render(
      <MemoryRouter initialEntries={["/settings/archive"]}>
        <BrowserNavigationBar />
      </MemoryRouter>,
    );

    expect(screen.getByText("Archived chats")).toBeTruthy();
  });

  it.each([
    ["/settings/app-server", "App Server"],
    ["/settings/hooks", "Hooks"],
    ["/settings/marketplaces", "Plugin marketplaces"],
    ["/settings/mcp-servers", "MCP servers"],
  ])("renders the %s settings breadcrumb", (pathname, label) => {
    render(
      <MemoryRouter initialEntries={[pathname]}>
        <BrowserNavigationBar />
      </MemoryRouter>,
    );

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settings" })).toBeTruthy();
  });

  it("renders the chat title in the shared breadcrumb", () => {
    render(
      <MemoryRouter initialEntries={["/chat/thread-1"]}>
        <BrowserNavigationBar chatTitle="Command demo" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Command demo")).toBeTruthy();
    expect(screen.queryByText("Conversation")).toBeNull();
  });

  it("renders the project list and project name in the project breadcrumb", () => {
    render(
      <MemoryRouter initialEntries={["/projects/project-1"]}>
        <BrowserNavigationBar projectTitle="Ruxex" />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Projects" }).getAttribute("href"),
    ).toBe("/projects");
    expect(screen.getByText("Ruxex")).toBeTruthy();
  });

  it("renders plugin details beneath the Plugins breadcrumb", () => {
    render(
      <MemoryRouter
        initialEntries={["/capabilities/plugins/openai-curated/calendar"]}
      >
        <BrowserNavigationBar />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Plugins" }).getAttribute("href"),
    ).toBe("/capabilities/plugins");
    expect(screen.getByText("calendar")).toBeTruthy();
  });
});
