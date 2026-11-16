import type { uiLocale } from "./i18n";

export type UiLocale = ReturnType<typeof uiLocale>;

// Locale is always explicit; omitting a timezone retains the system timezone.
export function dateTimeFormatter(
  locale: UiLocale,
  options?: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale, options);
}

export function formatNumber(
  value: number | bigint,
  locale: UiLocale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCompactNumber(value: number, locale: UiLocale): string {
  return formatNumber(value, locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).toLowerCase();
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: UiLocale,
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(
    value,
    unit,
  );
}
