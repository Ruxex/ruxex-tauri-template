import { describe, expect, it } from "vitest";

import type { ScheduleCadence } from "../../platform/schedules";
import { scheduleCadenceLabel } from "./schedule-format";

describe("schedule format", () => {
  it("lists every selected weekday in the schedule label", () => {
    const cadence: ScheduleCadence = {
      kind: "weekly",
      weekdays: [2, 4],
      hour: 15,
      minute: 0,
      timeZone: "Asia/Tokyo",
    };

    expect(scheduleCadenceLabel(cadence)).toBe(
      "Every Tuesday, Thursday · 15:00",
    );
  });
});
