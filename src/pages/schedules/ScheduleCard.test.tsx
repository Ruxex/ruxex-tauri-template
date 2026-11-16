// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { i18n } from "../../app/i18n";
import type { ScheduleRecord } from "../../platform/schedules";
import { ScheduleCard } from "./ScheduleCard";

afterEach(cleanup);

it("updates schedule timestamps in place without changing cadence or source values", async () => {
  const at = new Date(2025, 0, 2, 15, 4).toISOString();
  const schedule: ScheduleRecord = {
    id: "schedule",
    name: "User schedule",
    prompt: "User prompt",
    icon: "calendar",
    color: "blue",
    threadId: null,
    cadence: {
      kind: "daily",
      hour: 9,
      minute: 30,
      timeZone: "America/New_York",
    },
    enabled: true,
    nextRunAt: at,
    lastRun: { at, threadId: null, success: true, message: "External message" },
  };
  render(
    <ScheduleCard
      schedule={schedule}
      isTogglePending={false}
      isRunPending={false}
      isDeletePending={false}
      onEnabledChange={vi.fn()}
      onEdit={vi.fn()}
      onRequestAction={vi.fn()}
    />,
  );
  expect(screen.getByText(/^Next run:/).textContent).toContain(
    "Jan 2, 2025, 3:04 PM",
  );
  expect(screen.getByText("Every day · 09:30")).toBeTruthy();
  await act(async () => {
    await i18n.changeLanguage("ja");
  });
  expect(screen.getByText(/^次回の実行:/).textContent).toContain(
    "2025年1月2日 15:04",
  );
  expect(screen.getByText("毎日 · 09:30")).toBeTruthy();
  expect(schedule.nextRunAt).toBe(at);
  expect(schedule.cadence).toEqual({
    kind: "daily",
    hour: 9,
    minute: 30,
    timeZone: "America/New_York",
  });
});
