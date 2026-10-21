// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.hoisted(() => vi.fn());
const useAccount = vi.hoisted(() => vi.fn());
const useLogin = vi.hoisted(() => vi.fn());
const refetch = vi.hoisted(() => vi.fn());
const mutateAsync = vi.hoisted(() => vi.fn());
const login = vi.hoisted(() => ({
  mutateAsync,
  isPending: false,
  isError: false,
  error: null as Error | null,
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => navigate };
});
vi.mock("../app-server/hooks", () => ({ useAccount, useLogin }));

describe("LoginPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    navigate.mockReset();
    refetch.mockReset();
    mutateAsync.mockReset();
    login.error = null;
    login.isError = false;
    mutateAsync.mockResolvedValue({});
    refetch.mockResolvedValue({});
    useAccount.mockReturnValue({ refetch });
    useLogin.mockReturnValue(login);
  });

  it("logs in with the API key, refreshes the account, and navigates", async () => {
    const { LoginPage } = await import("./LoginPage");

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText("Enter your API key"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        type: "apiKey",
        apiKey: "secret",
      }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/account");
  });

  it("does not navigate when the login mutation fails", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("invalid key"));
    const { LoginPage } = await import("./LoginPage");

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText("Enter your API key"), {
      target: { value: "bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(refetch).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("renders a login error supplied by the mutation state", async () => {
    login.isError = true;
    login.error = new Error("invalid key");
    const { LoginPage } = await import("./LoginPage");

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Error: invalid key")).toBeTruthy();
  });
});
