// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppServerStatus } from "../app-server/api";
import type { AppServerDaemonOutput } from "../app-server/daemon-api";
import { SettingsSidebar } from "../components/sidebar/SettingsSidebar";
import { AppServerPage } from "./AppServerPage";

const useAppServerDaemon = vi.hoisted(() => vi.fn());
const useAppServerEvents = vi.hoisted(() => vi.fn());
const useAppServerStatus = vi.hoisted(() => vi.fn());
const useConfig = vi.hoisted(() => vi.fn());
const useConfigRequirements = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useAppServerDaemon,
  useAppServerEvents,
  useAppServerStatus,
  useConfig,
  useConfigRequirements,
}));

const runningDaemon: AppServerDaemonOutput = {
  status: "running",
  backend: "pid",
  pid: 42,
  managedRuxexPath: "/tmp/ruxex-desktop",
  managedRuxexVersion: "0.4.10",
  socketPath: "/tmp/ruxex.sock",
  cliVersion: "0.4.10",
  appServerVersion: "daemon-version",
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

function createStatusResult() {
  return {
    data: {
      socketPath: "/tmp/ruxex.sock",
      appServerVersion: "0.4.10",
    } as AppServerStatus,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  };
}

describe("AppServerPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useAppServerDaemon.mockReset().mockReturnValue(useDaemonResult());
    useAppServerEvents.mockReset().mockReturnValue({
      connected: true,
      resynchronizing: false,
    });
    useAppServerStatus.mockReset().mockReturnValue(createStatusResult());
    useConfig.mockReset().mockReturnValue({ data: { config: null } });
    useConfigRequirements
      .mockReset()
      .mockReturnValue({ data: { requirements: null } });
  });

  it("renders local connection and daemon details in one panel", () => {
    const daemon = useDaemonResult();
    const status = createStatusResult();
    useAppServerDaemon.mockReturnValue(daemon);
    useAppServerStatus.mockReturnValue(status);

    render(<AppServerPage />);

    expect(screen.getAllByRole("heading", { name: "AppServer" })).toHaveLength(
      2,
    );
    expect(screen.getByText("running")).toBeTruthy();
    expect(screen.getByText("0.4.10")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("/tmp/ruxex.sock")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("Synchronized")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    expect(daemon.control.mutate).toHaveBeenCalledWith("restart");

    fireEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(status.refetch).toHaveBeenCalledOnce();
  });

  it("renders Browser and Computer Use status in Runtime settings", () => {
    useConfig.mockReturnValue({
      data: { config: { browser_use: {}, computer_use: {} } },
    });
    useConfigRequirements.mockReturnValue({
      data: {
        requirements: {
          browserUse: {},
          computerUse: {},
          allowBrowserAndComputerUse: true,
        },
      },
    });

    render(<AppServerPage />);

    expect(
      screen.getByRole("heading", { name: "Browser and Computer Use" }),
    ).toBeTruthy();
    expect(screen.getByText("Browser use")).toBeTruthy();
    expect(screen.getByText("Computer use")).toBeTruthy();
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

  it("hides lifecycle controls outside the native runtime", () => {
    useAppServerDaemon.mockReturnValue(useDaemonResult({ isAvailable: false }));

    render(<AppServerPage />);

    for (const name of ["Start", "Restart", "Stop"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("renders InProcess mode without daemon lifecycle controls", () => {
    useAppServerDaemon.mockReturnValue(
      useDaemonResult({ mode: "inprocess", isAvailable: false }),
    );

    render(<AppServerPage />);

    expect(screen.getByText("InProcess mode")).toBeTruthy();
    expect(screen.getByText("0.4.10")).toBeTruthy();
    expect(screen.queryByText("PID")).toBeNull();
    expect(screen.queryByText("Socket")).toBeNull();
    for (const name of ["Start", "Restart", "Stop"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("shows App Server initialization errors with daemon recovery controls", () => {
    useAppServerDaemon.mockReturnValue(
      useDaemonResult({
        appServerError: new Error("in-process initialization failed"),
        appServerReady: false,
        isAvailable: true,
        mode: undefined,
      }),
    );

    render(<AppServerPage />);

    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Error: in-process initialization failed"),
    ).toBeTruthy();
    for (const name of ["Start", "Restart", "Stop"]) {
      expect(screen.getByRole("button", { name })).toHaveProperty(
        "disabled",
        false,
      );
    }
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

  it("groups settings navigation into personal and system sections", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsSidebar onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Personal" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "System" })).toBeTruthy();
    expect(screen.getByRole("separator")).toBeTruthy();
    expect(screen.getByRole("link", { name: "General" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Appearance" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Plugin marketplaces" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Models / Engines" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Runtime" })).toBeTruthy();
  });

  it("links to the plugin marketplace settings section", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <SettingsSidebar onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(
      screen
        .getByRole("link", { name: "Plugin marketplaces" })
        .getAttribute("href"),
    ).toBe("/settings/marketplaces");
  });
});
