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
            cadence: {
              kind: "daily",
              hour: 2,
              minute: 30,
              timeZone: "UTC",
            },
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
      setEnabled: {
        mutate: vi.fn(),
        isPending: false,
        isError: false,
      },
      remove: { mutate: vi.fn(), isPending: false },
      runNow: { mutate: vi.fn(), isPending: false },
    });
  });

  it("shows persisted schedules and confirms run-now/delete actions", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    const { container } = render(<SchedulesPage />);

    expect(container.firstElementChild?.className).toContain("mx-auto");
    expect(container.firstElementChild?.className).toContain("max-w-5xl");
    expect(screen.getByText("Nightly checks")).toBeTruthy();
    expect(screen.getByText("Last run failed: offline")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Run now: Nightly checks" }),
    );
    expect(
      screen.getByRole("heading", { name: "Run schedule now?" }),
    ).toBeTruthy();
    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.runNow.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Run now" }));
    expect(schedule.runNow.mutate).toHaveBeenCalledWith(
      "schedule-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(
      screen.getByRole("button", { name: "Delete: Nightly checks" }),
    );
    expect(
      screen.getByRole("heading", { name: "Delete schedule?" }),
    ).toBeTruthy();
    expect(schedule.remove.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(schedule.remove.mutate).toHaveBeenCalledWith(
      "schedule-1",
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("opens a schedule in the edit modal and saves changes", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit schedule: Nightly checks" }),
    );
    expect(screen.getByRole("heading", { name: "Edit schedule" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Schedule name"), {
      target: { value: "Morning checks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.update.mutate).toHaveBeenCalledWith(
      {
        id: "schedule-1",
        input: {
          name: "Morning checks",
          prompt: "run checks",
          threadId: null,
          cadence: {
            kind: "daily",
            hour: 2,
            minute: 30,
            timeZone: expect.any(String),
          },
          enabled: true,
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("updates the enabled state atomically from the edit modal", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Edit schedule: Nightly checks" }),
    );
    fireEvent.click(screen.getByLabelText("Enable schedule"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.update.mutate).toHaveBeenCalledWith(
      {
        id: "schedule-1",
        input: expect.objectContaining({ enabled: false }),
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(schedule.setEnabled.mutate).not.toHaveBeenCalled();
  });

  it("toggles a schedule from the list", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Disable schedule: Nightly checks",
      }),
    );

    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.setEnabled.mutate).toHaveBeenCalledWith({
      id: "schedule-1",
      enabled: false,
    });
  });

  it("creates a daily remote-continuation schedule", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));
    fireEvent.change(screen.getByLabelText("Schedule name"), {
      target: { value: "Remote checks" },
    });
    fireEvent.change(screen.getByLabelText("Instructions"), {
      target: { value: "run remote checks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create schedule" }));

    const schedule = useSchedules.mock.results[0]?.value;
    expect(schedule.create.mutate).toHaveBeenCalledWith(
      {
        name: "Remote checks",
        prompt: "run remote checks",
        threadId: null,
        cadence: {
          kind: "daily",
          hour: 9,
          minute: 0,
          timeZone: expect.any(String),
        },
        enabled: true,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("rejects a one-time schedule without a valid time", async () => {
    const { SchedulesPage } = await import("./SchedulesPage");
    render(<SchedulesPage />);
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));
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
