// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  childThreads: {
    isLoading: false,
    isError: false,
    data: { data: [] as unknown[] },
  },
  events: { threads: {} },
  pendingRequests: [] as unknown[],
}));

vi.mock("@/app-server/hooks", () => ({
  useSubagentThreadList: () => state.childThreads,
  useAppServerEvents: () => state.events,
  useServerRequests: () => state.pendingRequests,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => (options?.name ? `${key}:${options.name}` : key),
  }),
}));

import { SubagentsSection } from "./SubagentsSection";

function childThread(overrides: Record<string, unknown> = {}) {
  return {
    id: "child-1",
    environments: null,
    extra: null,
    sessionId: "session-1",
    forkedFromId: null,
    parentThreadId: "parent-1",
    preview: "Review the changes",
    ephemeral: false,
    section: null,
    sectionEnteredAt: null,
    projectId: null,
    historyMode: "paginated",
    model: "test-model",
    reasoningEffort: null,
    createdAt: 100,
    updatedAt: 200,
    recencyAt: 200,
    status: { type: "active" },
    path: null,
    cwd: "/workspace",
    cliVersion: "test",
    originator: null,
    source: "appServer",
    canAcceptDirectInput: true,
    threadSource: null,
    agentNickname: "Review helper",
    agentRole: null,
    gitInfo: null,
    name: null,
    daybreakEnabled: null,
    turns: [],
    ...overrides,
  };
}

describe("SubagentsSection", () => {
  afterEach(() => {
    cleanup();
    state.childThreads = {
      isLoading: false,
      isError: false,
      data: { data: [] },
    };
    state.events = { threads: {} };
    state.pendingRequests = [];
  });

  it("shows loading, error, and empty states", () => {
    state.childThreads.isLoading = true;
    const loading = render(<SubagentsSection onSelect={vi.fn()} parentThreadId="parent-1" selectedThreadId={null} />);
    expect(screen.getByText("loadingSubagents")).toBeTruthy();
    loading.unmount();

    state.childThreads = {
      isLoading: false,
      isError: true,
      data: { data: [] },
    };
    const failed = render(<SubagentsSection onSelect={vi.fn()} parentThreadId="parent-1" selectedThreadId={null} />);
    expect(screen.getByRole("alert").textContent).toBe("unableToLoadSubagents");
    failed.unmount();

    state.childThreads = {
      isLoading: false,
      isError: false,
      data: { data: [] },
    };
    render(<SubagentsSection onSelect={vi.fn()} parentThreadId="parent-1" selectedThreadId={null} />);
    expect(screen.getByText("noSubagentsYet")).toBeTruthy();
  });

  it("groups agents by status and selects a child thread", () => {
    state.childThreads.data.data = [
      childThread(),
      childThread({
        id: "child-2",
        agentNickname: "Completed helper",
        status: { type: "idle" },
      }),
    ];
    const onSelect = vi.fn();
    render(<SubagentsSection onSelect={onSelect} parentThreadId="parent-1" selectedThreadId="child-1" />);

    expect(screen.getByRole("heading", { name: "active" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "done" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "openSubagent:Review helper" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "openSubagent:Completed helper" }));
    expect(onSelect).toHaveBeenCalledWith("child-2");
  });
});
