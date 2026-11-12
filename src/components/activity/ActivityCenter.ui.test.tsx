// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityCenter } from "./ActivityCenter";

const useAppServerEvents = vi.hoisted(() => vi.fn());
const useServerRequests = vi.hoisted(() => vi.fn());
const useThreadList = vi.hoisted(() => vi.fn());
const resolveServerRequest = vi.hoisted(() => vi.fn());
const rejectServerRequestWithMessage = vi.hoisted(() => vi.fn());

vi.mock("../../app-server/hooks", () => ({
  useAppServerEvents,
  useServerRequests,
  useThreadList,
}));
vi.mock("../../app-server/api", () => ({
  resolveServerRequest,
  rejectServerRequestWithMessage,
}));

const pending = {
  requestId: 17,
  kind: "approval",
  threadId: "child-1",
  turnId: "turn-1",
  itemId: "item-1",
  request: {
    method: "item/commandExecution/requestApproval",
    id: 17,
    params: {
      command: "pnpm check",
      cwd: "/workspace",
      threadId: "child-1",
      turnId: "turn-1",
      itemId: "item-1",
    },
  },
} as never;

const events = {
  connected: true,
  resynchronizing: false,
  skippedEvents: 0,
  lastError: null,
  history: [],
  pendingServerRequests: { "approval-1": pending },
  threads: {
    "child-1": {
      threadId: "child-1",
      threadStatus: null,
      threadName: "API scout",
      archived: false,
      historyChangedAt: null,
      queueChangedAt: null,
      activeTurnId: "turn-1",
      status: "running",
      items: [],
      completedTurn: null,
      lastActivityAt: 300,
    },
  },
  seenEventIds: new Set(),
  eventSequence: 1,
} as never;

const childThread = {
  id: "child-1",
  parentThreadId: "parent-1",
  preview: "Inspect the API",
  name: "API scout",
} as never;

describe("ActivityCenter", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppServerEvents.mockReturnValue(events);
    useServerRequests.mockReturnValue([pending]);
    useThreadList.mockReturnValue({ data: { data: [childThread] } });
    resolveServerRequest.mockResolvedValue(undefined);
    rejectServerRequestWithMessage.mockResolvedValue(undefined);
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <ActivityCenter />
      </MemoryRouter>,
    );
  }

  it("shows activity entries and links the child thread", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Activity" })).toBeTruthy();
    expect(screen.getByText("API scout agent")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open thread/ }).getAttribute("href")).toBe(
      "/chat/child-1",
    );
  });

  it("shows approval cards in the needs action filter", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Needs action/ }));

    expect(screen.getByText("pnpm check")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve once" })).toBeTruthy();
    expect(screen.queryByText("API scout agent")).toBeNull();
  });

  it("filters the activity list to subagents", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Agents" }));

    expect(screen.getByText("API scout agent")).toBeTruthy();
    expect(screen.queryByText("Approval requested")).toBeNull();
  });
});
