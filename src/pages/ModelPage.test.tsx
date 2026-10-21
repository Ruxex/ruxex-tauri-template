// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccount = vi.hoisted(() => vi.fn());
const useModelList = vi.hoisted(() => vi.fn());
const useModelProvider = vi.hoisted(() => vi.fn());
const useModelProviderCapabilities = vi.hoisted(() => vi.fn());
const usePermissionProfiles = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useAccount,
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
    expect(screen.getByRole("heading", { name: "Capabilities" })).toBeTruthy();
  });
});
