// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useSchedules = vi.hoisted(() => vi.fn());
vi.mock("../app-server/hooks", () => ({ useSchedules }));
vi.mock("../app-server/runtime", () => ({ isDesktopRuntime: true }));

describe("SchedulesPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    useSchedules.mockReturnValue({
      query: {
        data: [
          {
            id: "schedule-1",
            name: "Nightly checks",
            prompt: "run checks",
            threadId: "thread-1",
            cadence: { kind: "daily", hour: 2, minute: 30 },
            nextRunAt: "2026-10-22T02:30:00Z",
            enabled: true,
            lastRun: {
              at: "2026-10-21T02:30:00Z",
              success: false,
              message: "offline",
            },
          },
        ],
        isLoading: false,
        isError: false,
      },
      create: { mutate: vi.fn(), isPending: false, isError: false },
      update: { mutate: vi.fn(), isPending: false },
      remove: { mutate: vi.fn(), isPending: false },
      runNow: { mutate: vi.fn(), isPending: false },
    });
  });

  it("shows persisted schedules and exposes run-now/delete actions", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);

    expect(screen.getByText("Nightly checks")).toBeTruthy();
    expect(screen.getByText("Last run failed: offline")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Run now: Nightly checks" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Delete: Nightly checks" }),
    );

    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.runNow.mutate).toHaveBeenCalledWith("schedule-1");
    expect(schedule.remove.mutate).toHaveBeenCalledWith("schedule-1");
  });

  it("creates a daily remote-continuation schedule", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);
    fireEvent.change(screen.getByLabelText("Schedule name"), {
      target: { value: "Remote checks" },
    });
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "run remote checks" },
    });
    fireEvent.change(screen.getByLabelText("Thread ID (optional)"), {
      target: { value: "thread-remote" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.create.mutate).toHaveBeenCalledWith({
      name: "Remote checks",
      prompt: "run remote checks",
      threadId: "thread-remote",
      cadence: { kind: "daily", hour: 9, minute: 0 },
    });
  });

  it("rejects a one-time schedule without a valid time", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);
    fireEvent.change(screen.getByLabelText("Cadence"), {
      target: { value: "once" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.create.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Choose a valid time for the one-time schedule."),
    ).toBeTruthy();
  });
});
