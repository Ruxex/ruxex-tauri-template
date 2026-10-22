// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listSchedules = vi.hoisted(() => vi.fn());
const createSchedule = vi.hoisted(() => vi.fn());
const deleteSchedule = vi.hoisted(() => vi.fn());
const runScheduleNow = vi.hoisted(() => vi.fn());

vi.mock("../../platform/schedules", () => ({
  listSchedules,
  createSchedule,
  deleteSchedule,
  runScheduleNow,
}));
vi.mock("../runtime", () => ({ isDesktopRuntime: true }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {children}
    </QueryClientProvider>
  );
}

describe("useSchedules", () => {
  beforeEach(() => {
    listSchedules.mockReset().mockResolvedValue([]);
    createSchedule.mockReset().mockResolvedValue({ id: "schedule-1" });
    deleteSchedule.mockReset().mockResolvedValue(undefined);
    runScheduleNow.mockReset().mockResolvedValue({ id: "schedule-1" });
  });

  it("loads and invalidates schedules after create/delete/run-now", async () => {
    const { useSchedules } = await import("./useSchedules");
    const { result } = renderHook(() => useSchedules(), { wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    await act(async () => {
      await result.current.create.mutateAsync({
        name: "Checks",
        prompt: "run checks",
        threadId: null,
        cadence: {
          kind: "daily",
          hour: 2,
          minute: 30,
          timeZone: "UTC",
        },
        enabled: true,
      });
      await result.current.runNow.mutateAsync("schedule-1");
      await result.current.remove.mutateAsync("schedule-1");
    });

    expect(createSchedule).toHaveBeenCalledOnce();
    expect(runScheduleNow.mock.calls[0]?.[0]).toBe("schedule-1");
    expect(deleteSchedule.mock.calls[0]?.[0]).toBe("schedule-1");
  });
});
