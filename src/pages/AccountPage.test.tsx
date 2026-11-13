// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccount = vi.hoisted(() => vi.fn());
const useLogin = vi.hoisted(() => vi.fn());
const useLogout = vi.hoisted(() => vi.fn());
vi.mock("../app-server/hooks", () => ({ useAccount, useLogin, useLogout }));

describe("AccountPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useAccount.mockReset();
    useLogin.mockReturnValue({
      error: null,
      isError: false,
      isPending: false,
      mutateAsync: vi.fn(),
    });
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

    expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
    expect(screen.getByText("Authenticated")).toBeTruthy();
    expect(screen.getByText("API key")).toBeTruthy();
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

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByLabelText("API key")).toBeTruthy();
    expect(
      screen.queryByText("API key", { selector: ".label-text" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Back home" })).toBeNull();
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
