// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useCreateThread = vi.hoisted(() => vi.fn());
const useModelList = vi.hoisted(() => vi.fn());
const useProject = vi.hoisted(() => vi.fn());
const useSendMessage = vi.hoisted(() => vi.fn());

vi.mock("../app-server/hooks", () => ({
  useCreateThread,
  useModelList,
  useProject,
  useSendMessage,
}));
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => vi.fn() };
});

describe("HomePage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useCreateThread.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: vi.fn(),
    });
    useModelList.mockReturnValue({ data: { data: [] } });
    useProject.mockReturnValue({ data: undefined });
    useSendMessage.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: vi.fn(),
    });
  });

  it("renders a centered welcome state with a chat composer", async () => {
    const { HomePage } = await import("./HomePage");

    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Let's get started" })).toBeTruthy();
    expect(screen.getByLabelText("Model")).toBeTruthy();
    expect(screen.getByLabelText("Reasoning")).toBeTruthy();
    expect(screen.getByLabelText("Permissions")).toBeTruthy();
    expect(screen.getByLabelText("Message")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Attach image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voice input" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send message" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New chat" })).toBeNull();
  });
});
