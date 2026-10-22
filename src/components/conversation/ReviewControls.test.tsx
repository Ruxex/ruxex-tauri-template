// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.hoisted(() => vi.fn());
const useStartReview = vi.hoisted(() => vi.fn());
const review = vi.hoisted(() => ({
  mutateAsync,
  isPending: false,
  isError: false,
  error: null as Error | null,
}));

vi.mock("../../app-server/hooks", () => ({ useStartReview }));

describe("ReviewControls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ reviewThreadId: "thread-1" });
    review.isPending = false;
    review.isError = false;
    review.error = null;
    useStartReview.mockReturnValue(review);
  });

  it("starts an inline review for uncommitted changes", async () => {
    const { ReviewControls } = await import("./ReviewControls");

    render(<ReviewControls threadId="thread-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        threadId: "thread-1",
        target: { type: "uncommittedChanges" },
        delivery: "inline",
      }),
    );
    expect(
      screen
        .getByRole("button", { name: "Review changes" })
        .querySelector("svg"),
    ).toBeTruthy();
    expect(screen.getByText("Review started.")).toBeTruthy();
  });

  it("shows the mutation error when review startup fails", async () => {
    review.isError = true;
    review.error = new Error("review unavailable");
    const { ReviewControls } = await import("./ReviewControls");

    render(<ReviewControls threadId="thread-1" />);
    expect(screen.getByText("Error: review unavailable")).toBeTruthy();
  });

  it("disables the action while a review is pending", async () => {
    review.isPending = true;
    const { ReviewControls } = await import("./ReviewControls");

    render(<ReviewControls threadId="thread-1" />);

    expect(
      screen.getByRole("button", { name: "Starting review…" }),
    ).toHaveProperty("disabled", true);
  });
});
