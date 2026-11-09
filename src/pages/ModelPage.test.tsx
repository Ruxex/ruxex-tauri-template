// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccount = vi.hoisted(() => vi.fn());
const useModelList = vi.hoisted(() => vi.fn());
const useModelProvider = vi.hoisted(() => vi.fn());
const useModelProviderCapabilities = vi.hoisted(() => vi.fn());
const usePermissionProfiles = vi.hoisted(() => vi.fn());
const useAppServerStatus = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useAccount,
  useAppServerStatus,
  useModelList,
  useModelProvider,
  useModelProviderCapabilities,
  usePermissionProfiles,
}));

describe("ModelPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAccount.mockReturnValue({
      data: {
        authStatus: "authenticated",
        displayName: "Ada",
        providerId: "ruxex",
        usage: { limitName: "Standard" },
      },
    });
    useModelList.mockReturnValue({ data: { data: [{ id: "model-1" }] } });
    useModelProvider.mockReturnValue({ data: { name: "Ruxex" } });
    useModelProviderCapabilities.mockReturnValue({
      data: { browser: true },
    });
    usePermissionProfiles.mockReturnValue({
      data: { data: [{ id: "default" }] },
    });
    useAppServerStatus.mockReturnValue({
      data: { homeDataDir: "/home/ada/.ruxex_desktop" },
    });
  });

  it("renders model settings in their own tab", async () => {
    const { ModelPage } = await import("./ModelPage");

    render(
      <MemoryRouter>
        <ModelPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Models" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Provider and account" }),
    ).toBeTruthy();
    expect(screen.getByText("Data directory")).toBeTruthy();
    expect(screen.getByText("/home/ada/.ruxex_desktop")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Capabilities" })).toBeTruthy();
  });

  it("falls back when the runtime does not report a data directory", async () => {
    useAppServerStatus.mockReturnValue({ data: undefined });

    const { ModelPage } = await import("./ModelPage");

    render(
      <MemoryRouter>
        <ModelPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Data directory")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
  });
});
