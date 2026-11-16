import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduleCadence } from "../../platform/schedules";
import { i18n } from "../../app/i18n";
import {
  browserTimeZone,
  formatDateTime,
  formatRelativeDateTime,
  scheduleCadenceLabel,
  systemTimeZoneLabel,
} from "./schedule-format";

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

describe("localized schedule timestamps", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each(["en", "ja"] as const)(
    "uses the %s UI language for absolute dates",
    async (locale) => {
      await i18n.changeLanguage(locale);
      // A local date keeps this assertion independent of the machine timezone.
      const value = new Date(2025, 0, 2, 15, 4).toISOString();
      const formatted = formatDateTime(value);
      expect(formatted).toContain(
        locale === "ja" ? "2025年1月2日" : "Jan 2, 2025",
      );
      expect(formatted).toContain(locale === "ja" ? "15:04" : "3:04 PM");
      expect(formatDateTime("invalid date")).toBe("invalid date");
      expect(formatRelativeDateTime("invalid date")).toBe("invalid date");
    },
  );

  it("localizes the timezone label while retaining the detected IANA timezone", () => {
    vi.stubEnv("TZ", "Asia/Tokyo");
    expect(browserTimeZone()).toBe("Asia/Tokyo");
    expect(systemTimeZoneLabel("en")).toBe("GMT+9 (Asia/Tokyo)");
    expect(systemTimeZoneLabel("ja")).toBe("JST (Asia/Tokyo)");
    vi.stubEnv("TZ", "UTC");
    expect(browserTimeZone()).toBe("UTC");
    expect(systemTimeZoneLabel("en")).toBe("UTC (UTC)");
    expect(systemTimeZoneLabel("ja")).toBe("UTC (UTC)");
  });

  it.each([
    ["en", "2 minutes ago", "just now"],
    ["ja", "2分前", "たった今"],
  ] as const)(
    "preserves translated relative messages in %s",
    async (locale, elapsed, now) => {
      await i18n.changeLanguage(locale);
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-02T15:04:00Z"));
      expect(formatRelativeDateTime("2025-01-02T15:02:00Z")).toBe(elapsed);
      expect(formatRelativeDateTime("2025-01-02T15:04:10Z")).toBe(now);
    },
  );
});
