import { describe, expect, it } from "vitest";

import { dateTimeFormatter, formatCompactNumber, formatNumber, formatRelativeTime } from "./locale-format";

describe("locale formatting", () => {
  it.each([
    ["en", "Jan 2, 2025, 3:04 PM"],
    ["ja", "2025/01/02 15:04"],
  ] as const)("formats dates in %s with the requested timezone", (locale, expected) => {
    const date = new Date("2025-01-02T15:04:00Z");
    expect(
      dateTimeFormatter(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date),
    ).toBe(expected);
    expect(
      dateTimeFormatter(locale, {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone: "Asia/Tokyo",
      }).format(date),
    ).toBe("00:04");
    expect(date.toISOString()).toBe("2025-01-02T15:04:00.000Z");
  });

  it.each(["en", "ja"] as const)("formats numbers and bigints in %s without losing precision", (locale) => {
    expect(formatNumber(123456.789, locale, { maximumFractionDigits: 2 })).toBe("123,456.79");
    expect(formatNumber(9007199254740993n, locale)).toBe("9,007,199,254,740,993");
    expect(formatNumber(1.25, locale, { style: "percent" })).toBe("125%");
  });

  it.each([
    ["en", "123.5k", "1.2m", "2 minutes ago", "in 3 hours"],
    ["ja", "12.3万", "123.5万", "2 分前", "3 時間後"],
  ] as const)("formats compact token counts and relative time in %s", (locale, compact, million, past, future) => {
    expect(formatCompactNumber(123456, locale)).toBe(compact);
    expect(formatCompactNumber(1234567, locale)).toBe(million);
    expect(formatCompactNumber(0, locale)).toBe("0");
    expect(formatRelativeTime(-2, "minute", locale)).toBe(past);
    expect(formatRelativeTime(3, "hour", locale)).toBe(future);
  });
});
