// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const useSchedules = vi.hoisted(() => vi.fn());
vi.mock("../../app-server/hooks", () => ({ useSchedules }));

describe("AutomationSidebar", () => {
  afterEach(cleanup);

  it("orders recent runs by their run time", async () => {
    useSchedules.mockReturnValue({
      query: {
        data: [
          {
            id: "older",
            name: "Older checks",
            prompt: "older",
            threadId: null,
            cadence: { kind: "daily", hour: 8, minute: 0, timeZone: "UTC" },
            enabled: true,
            nextRunAt: "2026-11-11T08:00:00Z",
            lastRun: {
              at: "2026-11-09T08:00:00Z",
              success: true,
              message: "ok",
            },
          },
          {
            id: "newer",
            name: "Newest review",
            prompt: "newer",
            threadId: null,
            cadence: { kind: "daily", hour: 9, minute: 0, timeZone: "UTC" },
            enabled: true,
            nextRunAt: "2026-11-11T09:00:00Z",
            lastRun: {
              at: "2026-11-10T09:00:00Z",
              success: false,
              message: "offline",
            },
          },
        ],
        isLoading: false,
        isError: false,
      },
    });

    const { AutomationSidebar } = await import("./AutomationSidebar");
    render(
      <MemoryRouter>
        <AutomationSidebar onClose={() => undefined} />
      </MemoryRouter>,
    );

    const items = screen.getAllByTestId("recent-automation-item");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Newest review");
    expect(items[1].textContent).toContain("Older checks");
    expect(screen.queryByText("Open Automation")).toBeNull();
  });
});
