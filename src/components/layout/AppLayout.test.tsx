// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useOutletContext,
} from "react-router-dom";
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
vi.mock("../git-diff/GitDiffReviewPane", () => ({
  GitDiffReviewPane: ({
    target,
  }: {
    target: { threadId: string; workspace: string };
  }) => (
    <div data-testid="git-diff-target">
      {target.threadId}|{target.workspace}
    </div>
  ),
}));

import type { AppOutletContext } from "../../app/app-outlet-context";
import { AppLayout } from "./AppLayout";

function DiffActions() {
  const { openThreadDiff } = useOutletContext<AppOutletContext>();
  return (
    <div>
      <button
        onClick={() =>
          openThreadDiff({ threadId: "thread-1", workspace: "/repo-one" })
        }
        type="button"
      >
        Open first diff
      </button>
      <button
        onClick={() =>
          openThreadDiff({ threadId: "thread-2", workspace: "/repo-two" })
        }
        type="button"
      >
        Open second diff
      </button>
    </div>
  );
}

function renderWithDiffActions() {
  useUiPreferences.mockReturnValue({
    preferences: { sidebarCollapsed: false },
    update: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DiffActions />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

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
    expect(
      screen.getByTestId("right-pane-resize-handle").querySelector("div"),
    ).toBeTruthy();
    expect(pane.textContent).toBe("");
    expect(group.className).toContain("flex");
    expect(
      screen.getByRole("button", { name: "Close right pane" }),
    ).toBeTruthy();
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

  it("opens a Git diff tab in the right pane", async () => {
    renderWithDiffActions();

    fireEvent.click(screen.getByRole("button", { name: "Open first diff" }));

    expect(
      screen.getByTestId("right-pane-panel").getAttribute("data-pane-open"),
    ).toBe("true");
    expect(
      screen.getByRole("tab", { name: "Git Diff — repo-one" }),
    ).toBeTruthy();
    expect(await screen.findByText("thread-1|/repo-one")).toBeTruthy();
  });

  it("reuses an existing tab for the same thread and workspace", () => {
    renderWithDiffActions();

    fireEvent.click(screen.getByRole("button", { name: "Open first diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Open second diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Open first diff" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(
      screen
        .getByRole("tab", { name: "Git Diff — repo-one" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      within(
        screen.getByRole("tabpanel", { name: "Git Diff — repo-one" }),
      ).getByTestId("git-diff-target").textContent,
    ).toBe("thread-1|/repo-one");
  });

  it("selects the remaining tab when the active tab closes", async () => {
    renderWithDiffActions();

    fireEvent.click(screen.getByRole("button", { name: "Open first diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Open second diff" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Close Git Diff — repo-two tab" }),
    );

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(
      screen
        .getByRole("tab", { name: "Git Diff — repo-one" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      within(
        screen.getByRole("tabpanel", { name: "Git Diff — repo-one" }),
      ).getByTestId("git-diff-target").textContent,
    ).toBe("thread-1|/repo-one");
    expect(
      screen.getByTestId("right-pane-panel").getAttribute("data-pane-open"),
    ).toBe("true");
  });

  it("keeps the active tab when an inactive tab closes", () => {
    renderWithDiffActions();

    fireEvent.click(screen.getByRole("button", { name: "Open first diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Open second diff" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Close Git Diff — repo-one tab" }),
    );

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(
      screen
        .getByRole("tab", { name: "Git Diff — repo-two" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("closes the right pane when its last tab closes", () => {
    renderWithDiffActions();

    fireEvent.click(screen.getByRole("button", { name: "Open first diff" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Close Git Diff — repo-one tab" }),
    );

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(
      screen.getByTestId("right-pane-panel").getAttribute("data-pane-open"),
    ).toBe("false");
  });

  it("preserves tabs when the right pane is hidden and reopened", () => {
    renderWithDiffActions();

    fireEvent.click(screen.getByRole("button", { name: "Open first diff" }));
    fireEvent.click(screen.getByRole("button", { name: "Close right pane" }));
    fireEvent.click(screen.getByRole("button", { name: "Open right pane" }));

    expect(
      screen.getByRole("tab", { name: "Git Diff — repo-one" }),
    ).toBeTruthy();
    expect(
      screen.getByTestId("right-pane-panel").getAttribute("data-pane-open"),
    ).toBe("true");
  });
});
