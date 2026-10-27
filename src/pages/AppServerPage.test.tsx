// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppServerDaemonOutput } from "../app-server/daemon-api";
import { SettingsSidebar } from "../components/sidebar/SettingsSidebar";
import { AppServerPage } from "./AppServerPage";

const useAppServerDaemon = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({ useAppServerDaemon }));

const runningDaemon: AppServerDaemonOutput = {
  status: "running",
  backend: "pid",
  pid: 42,
  managedRuxexPath: "/tmp/ruxex-desktop",
  managedRuxexVersion: "0.4.10",
  socketPath: "/tmp/ruxex.sock",
  cliVersion: "0.4.10",
  appServerVersion: "0.4.10",
};

function useDaemonResult(
  overrides: Partial<ReturnType<typeof createDaemonResult>> = {},
) {
  return { ...createDaemonResult(), ...overrides };
}

function createDaemonResult() {
  return {
    status: {
      data: runningDaemon,
      isError: false,
      error: null,
      isLoading: false,
    },
    control: {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null as unknown,
    },
    appServerError: undefined as unknown,
    appServerReady: true,
    isAvailable: true,
    mode: "daemon" as "daemon" | "inprocess",
  };
}

describe("AppServerPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppServerDaemon.mockReset().mockReturnValue(useDaemonResult());
  });

  it("renders daemon details and delegates lifecycle actions", () => {
    const daemon = useDaemonResult();
    useAppServerDaemon.mockReturnValue(daemon);

    render(<AppServerPage />);

    expect(screen.getAllByRole("heading", { name: "AppServer" })).toHaveLength(
      2,
    );
    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.getByText("0.4.10")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("/tmp/ruxex.sock")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(daemon.control.mutate).toHaveBeenCalledWith("restart");
  });

  it("disables lifecycle controls while an action is pending", () => {
    useAppServerDaemon.mockReturnValue(
      useDaemonResult({
        control: {
          mutate: vi.fn(),
          isPending: true,
          isError: false,
          error: null,
        },
      }),
    );

    render(<AppServerPage />);

    for (const name of ["Start", "Restart", "Stop"]) {
      expect(screen.getByRole("button", { name })).toHaveProperty(
        "disabled",
        true,
      );
    }
  });

  it("shows lifecycle errors inline", () => {
    useAppServerDaemon.mockReturnValue(
      useDaemonResult({
        control: {
          mutate: vi.fn(),
          isPending: false,
          isError: true,
          error: new Error("daemon unavailable"),
        },
      }),
    );

    render(<AppServerPage />);

    expect(screen.getByText("Error: daemon unavailable")).toBeTruthy();
  });

  it("disables lifecycle controls outside the native runtime", () => {
    useAppServerDaemon.mockReturnValue(useDaemonResult({ isAvailable: false }));

    render(<AppServerPage />);

    for (const name of ["Start", "Restart", "Stop"]) {
      expect(screen.getByRole("button", { name })).toHaveProperty(
        "disabled",
        true,
      );
    }
  });

  it("renders InProcess mode without daemon lifecycle controls", () => {
    useAppServerDaemon.mockReturnValue(
      useDaemonResult({ mode: "inprocess", isAvailable: false }),
    );

    render(<AppServerPage />);

    expect(screen.getByText("InProcess mode")).toBeTruthy();
    expect(screen.queryByText("PID")).toBeNull();
    expect(screen.queryByText("Socket")).toBeNull();
    for (const name of ["Start", "Restart", "Stop"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("shows App Server initialization errors without daemon controls", () => {
    useAppServerDaemon.mockReturnValue(
      useDaemonResult({
        appServerError: new Error("in-process initialization failed"),
        appServerReady: false,
        isAvailable: false,
        mode: undefined,
      }),
    );

    render(<AppServerPage />);

    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(
      screen.getByText("Error: in-process initialization failed"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
  });
});

describe("SettingsSidebar AppServer navigation", () => {
  afterEach(() => {
    cleanup();
  });

  it("links to the Runtime settings section", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsSidebar onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: "Runtime" }).getAttribute("href"),
    ).toBe("/settings/app-server");
  });
});
