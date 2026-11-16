// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { i18n } from "../app/i18n";
import type { ScheduleRecord } from "../platform/schedules";
import { ScheduleDetailPage } from "./ScheduleDetailPage";

const useSchedules = vi.hoisted(() => vi.fn());
vi.mock("../app-server/hooks", () => ({
  useSchedules,
  useArchiveThread: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useThread: () => ({ data: null }),
  useAppServerEvents: () => ({ threads: {}, pendingServerRequests: {} }),
}));

afterEach(cleanup);

it("localizes next-run and history dates while preserving machine-readable timestamps", async () => {
  const at = new Date(2025, 0, 2, 15, 4).toISOString();
  const run = {
    at,
    threadId: null,
    success: true,
    message: "Server run message",
  };
  const schedule: ScheduleRecord = {
    id: "schedule",
    name: "User schedule",
    prompt: "User instructions",
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
    lastRun: run,
    runs: [run, { ...run, threadId: "thread" }],
  };
  useSchedules.mockReturnValue({
    query: { data: [schedule] },
    update: {},
    setEnabled: {},
    runNow: {},
    remove: {},
  });
  const { container } = render(
    <MemoryRouter initialEntries={["/schedules/schedule"]}>
      <Routes>
        <Route path="/schedules/:scheduleId" element={<ScheduleDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
  const times = Array.from(container.querySelectorAll("time"));
  expect(times).toHaveLength(3);
  for (const time of times) {
    expect(time.textContent).toContain("Jan 2, 2025, 3:04 PM");
    expect(time.dateTime).toBe(at);
  }
  await act(async () => {
    await i18n.changeLanguage("ja");
  });
  for (const time of times) {
    expect(time.textContent).toContain("2025年1月2日 15:04");
    expect(time.dateTime).toBe(at);
  }
  expect(screen.getByText("User instructions")).toBeTruthy();
  expect(screen.getAllByText("Server run message")).toHaveLength(2);
});
