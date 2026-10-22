import { describe, expect, it } from "vitest";

import type { ScheduleRecord } from "../../platform/schedules";
import {
  createScheduleFormState,
  scheduleFormReducer,
  scheduleInputFromForm,
} from "./schedule-form";

const record = (overrides: Partial<ScheduleRecord> = {}): ScheduleRecord => ({
  id: "schedule-1",
  name: "Nightly checks",
  prompt: "run checks",
  threadId: "thread-1",
  cadence: {
    kind: "daily",
    hour: 2,
    minute: 30,
    timeZone: "Asia/Tokyo",
  },
  enabled: false,
  nextRunAt: "2026-10-22T02:30:00Z",
  lastRun: null,
  ...overrides,
});

describe("schedule form model", () => {
  it("creates default and editable form state", () => {
    expect(createScheduleFormState()).toEqual({
      name: "",
      prompt: "",
      cadenceKind: "daily",
      runAtTime: "09:00",
      weekday: "1",
      onceAt: "",
      enabled: true,
    });

    expect(createScheduleFormState(record())).toMatchObject({
      name: "Nightly checks",
      prompt: "run checks",
      cadenceKind: "daily",
      runAtTime: "02:30",
      weekday: "1",
      onceAt: "",
      enabled: false,
    });

    expect(
      createScheduleFormState(
        record({
          cadence: {
            kind: "weekly",
            weekday: 5,
            hour: 18,
            minute: 45,
            timeZone: "Europe/London",
          },
        }),
      ),
    ).toMatchObject({
      cadenceKind: "weekly",
      runAtTime: "18:45",
      weekday: "5",
    });

    expect(
      createScheduleFormState(
        record({ cadence: { kind: "once", at: "2026-10-22T02:30:00Z" } }),
      ).onceAt,
    ).not.toBe("");
  });

  it("updates fields through discriminated reducer actions", () => {
    const initial = createScheduleFormState();
    const named = scheduleFormReducer(initial, {
      type: "nameChanged",
      value: "Checks",
    });
    const disabled = scheduleFormReducer(named, {
      type: "enabledChanged",
      value: false,
    });

    expect(disabled).toMatchObject({ name: "Checks", enabled: false });
  });

  it("converts daily and weekly forms with trimmed values and timezone", () => {
    const daily = scheduleInputFromForm(
      {
        ...createScheduleFormState(),
        name: "  Daily checks  ",
        prompt: "  run checks  ",
        runAtTime: "07:15",
        enabled: false,
      },
      "Asia/Tokyo",
    );
    expect(daily).toEqual({
      ok: true,
      input: {
        name: "Daily checks",
        prompt: "run checks",
        threadId: null,
        cadence: {
          kind: "daily",
          hour: 7,
          minute: 15,
          timeZone: "Asia/Tokyo",
        },
        enabled: false,
      },
    });

    const weekly = scheduleInputFromForm(
      {
        ...createScheduleFormState(),
        cadenceKind: "weekly",
        weekday: "4",
        runAtTime: "18:45",
      },
      "America/New_York",
    );
    expect(weekly).toMatchObject({
      ok: true,
      input: {
        cadence: {
          kind: "weekly",
          weekday: 4,
          hour: 18,
          minute: 45,
          timeZone: "America/New_York",
        },
        enabled: true,
      },
    });
  });

  it("converts a valid one-time form and rejects an invalid timestamp", () => {
    const valid = scheduleInputFromForm(
      {
        ...createScheduleFormState(),
        cadenceKind: "once",
        onceAt: "2026-10-22T09:30",
      },
      "Asia/Tokyo",
    );
    expect(valid).toMatchObject({
      ok: true,
      input: { cadence: { kind: "once", at: expect.any(String) } },
    });

    expect(
      scheduleInputFromForm(
        { ...createScheduleFormState(), cadenceKind: "once", onceAt: "" },
        "Asia/Tokyo",
      ),
    ).toEqual({
      ok: false,
      message: "Choose a valid time for the one-time schedule.",
    });
  });
});
