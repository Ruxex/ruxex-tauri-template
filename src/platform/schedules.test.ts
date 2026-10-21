import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("schedule native bridge", () => {
  beforeEach(() => invoke.mockReset());

  it("maps schedule CRUD commands without local persistence", async () => {
    const record = { id: "schedule-1", name: "Checks" };
    invoke
      .mockResolvedValueOnce([record])
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(record);
    const schedules = await import("./schedules");
    const input = {
      name: "Checks",
      prompt: "run checks",
      threadId: null,
      cadence: { kind: "daily", hour: 2, minute: 30 } as const,
    };

    await expect(schedules.listSchedules()).resolves.toEqual([record]);
    await expect(schedules.createSchedule(input)).resolves.toEqual(record);
    await expect(
      schedules.updateSchedule("schedule-1", input),
    ).resolves.toEqual(record);
    await expect(
      schedules.deleteSchedule("schedule-1"),
    ).resolves.toBeUndefined();
    await expect(schedules.runScheduleNow("schedule-1")).resolves.toEqual(
      record,
    );

    expect(invoke).toHaveBeenNthCalledWith(1, "schedule_list");
    expect(invoke).toHaveBeenNthCalledWith(2, "schedule_create", { input });
    expect(invoke).toHaveBeenNthCalledWith(3, "schedule_update", {
      id: "schedule-1",
      input,
    });
    expect(invoke).toHaveBeenNthCalledWith(4, "schedule_delete", {
      id: "schedule-1",
    });
    expect(invoke).toHaveBeenNthCalledWith(5, "schedule_run_now", {
      id: "schedule-1",
    });
  });
});
