// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccount = vi.hoisted(() => vi.fn());
vi.mock("../app-server/hooks", () => ({ useAccount }));

describe("AccountPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAccount.mockReset();
  });

  it("renders authenticated account information without a login CTA", async () => {
    useAccount.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { authStatus: "authenticated", account: { type: "apiKey" } },
    });
    const { AccountPage } = await import("./AccountPage");

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Authenticated")).toBeTruthy();
    expect(screen.getByText("apiKey")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });

  it("offers login when authentication is required", async () => {
    useAccount.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { authStatus: "unauthenticated", account: null },
    });
    const { AccountPage } = await import("./AccountPage");

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Authentication required")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Log in" }).getAttribute("href"),
    ).toBe("/login");
  });

  it("renders query errors instead of an empty account", async () => {
    useAccount.mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error("account unavailable"),
    });
    const { AccountPage } = await import("./AccountPage");

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Error: account unavailable")).toBeTruthy();
  });
});
