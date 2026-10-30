// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccount = vi.hoisted(() => vi.fn());
const useLogout = vi.hoisted(() => vi.fn());
vi.mock("../app-server/hooks", () => ({ useAccount, useLogout }));

describe("AccountPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAccount.mockReset();
    useLogout.mockReturnValue({
      isError: false,
      isPending: false,
      mutate: vi.fn(),
    });
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

    const heading = screen.getByRole("heading", { name: "Account" });
    expect(heading.className).toContain("text-3xl");
    expect(heading.className).toContain("tracking-tight");
    expect(
      screen
        .getByText("Authenticated")
        .querySelector("svg")
        ?.getAttribute("class"),
    ).toContain("text-success");
    expect(screen.getByText("apiKey")).toBeTruthy();
    expect(
      screen
        .getByRole("heading", { name: "Account information" })
        .closest("section")?.className,
    ).toContain("overflow-hidden");
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });

  it("allows an authenticated account to log out", async () => {
    const mutate = vi.fn();
    useAccount.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { authStatus: "authenticated", account: { type: "apiKey" } },
    });
    useLogout.mockReturnValue({ isError: false, isPending: false, mutate });
    const { AccountPage } = await import("./AccountPage");

    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(mutate).toHaveBeenCalledTimes(1);
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

    expect(
      screen
        .getByText("Authentication required")
        .querySelector("svg")
        ?.getAttribute("class"),
    ).toContain("text-warning");
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
