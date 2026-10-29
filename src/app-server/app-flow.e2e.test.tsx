// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../app/providers";
import { LoginPage } from "../pages/LoginPage";
import { HomePage } from "../pages/HomePage";
import { MockAppServer } from "../test-support/mock-app-server";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
const { listen } = vi.hoisted(() => ({ listen: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

describe("desktop app-server flow", () => {
  let server: MockAppServer;

  beforeEach(() => {
    server = new MockAppServer();
    invoke.mockReset();
    invoke.mockImplementation((command: string, args: unknown) =>
      server.invoke(command, args as never),
    );
    listen.mockReset();
    listen.mockResolvedValue(() => undefined);
    server.respond("model/list", { data: [], nextCursor: null });
    server.respond("account/read", { account: null } as never);
    server.respond("account/login/start", { type: "apiKey" });
    server.respond("thread/start", {
      thread: { id: "thread-created" },
    } as never);
    server.respond("thread/resume", {
      thread: { id: "thread-created" },
    } as never);
    server.respond("turn/start", { turn: { id: "turn-created" } } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("creates a thread and sends its first message through the mock app server", async () => {
    const router = createMemoryRouter(
      [
        { path: "/", element: <HomePage /> },
        { path: "/chat/:threadId", element: <p>Thread created</p> },
      ],
      { initialEntries: ["/"] },
    );

    render(<AppProviders router={router} />);

    await screen.findByRole("heading", { name: "Let's get started" });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Review this project" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/chat/thread-created"),
    );

    expect(server.requests.map((request) => request.method)).toEqual([
      "thread/start",
      "thread/resume",
      "turn/start",
    ]);
    expect(server.requests[0]).toMatchObject({
      method: "thread/start",
      params: {
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
      },
    });
    expect(server.requests[1]).toMatchObject({
      method: "thread/resume",
      params: { threadId: "thread-created", excludeTurns: true },
    });
    expect(server.requests[2]).toMatchObject({
      method: "turn/start",
      params: {
        threadId: "thread-created",
        input: [
          { type: "text", text: "Review this project", text_elements: [] },
        ],
      },
    });
  });

  it("logs in with an API key and refreshes account data", async () => {
    const router = createMemoryRouter(
      [
        { path: "/login", element: <LoginPage /> },
        { path: "/account", element: <p>Account page</p> },
      ],
      { initialEntries: ["/login"] },
    );

    render(<AppProviders router={router} />);

    fireEvent.change(await screen.findByLabelText("API key"), {
      target: { value: "test-api-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/account"),
    );

    expect(invoke).toHaveBeenCalledWith("ensure_app_server");
    expect(server.requests.map((request) => request.method)).toEqual([
      "account/login/start",
      "account/read",
    ]);
    expect(server.requests[0]).toMatchObject({
      method: "account/login/start",
      params: { type: "apiKey", apiKey: "test-api-key" },
    });
  });
});
