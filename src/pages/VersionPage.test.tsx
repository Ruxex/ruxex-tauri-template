// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAppServerDaemon = vi.hoisted(() => vi.fn());
const useAppServerStatus = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useAppServerDaemon,
  useAppServerStatus,
}));

describe("VersionPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAppServerStatus.mockReturnValue({
      data: { appServerVersion: "0.4.10" },
    });
    useAppServerDaemon.mockReturnValue({
      status: {
        data: {
          managedRuxexVersion: "0.4.10",
          cliVersion: "0.4.10-cli",
        },
      },
    });
  });

  it("renders application and runtime versions in their own settings tab", async () => {
    const { VersionPage } = await import("./VersionPage");

    render(
      <MemoryRouter>
        <VersionPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Version" })).toBeTruthy();
    expect(screen.getByText("Ruxex Desktop")).toBeTruthy();
    expect(screen.getByText("App Server")).toBeTruthy();
    expect(screen.getByText("Managed Ruxex")).toBeTruthy();
    expect(screen.getByText("CLI")).toBeTruthy();
    expect(screen.getByText("0.4.10-cli")).toBeTruthy();
  });

  it("shows unavailable when runtime versions are not reported", async () => {
    useAppServerStatus.mockReturnValue({ data: undefined });
    useAppServerDaemon.mockReturnValue({ status: { data: undefined } });

    const { VersionPage } = await import("./VersionPage");

    render(
      <MemoryRouter>
        <VersionPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
  });
});
