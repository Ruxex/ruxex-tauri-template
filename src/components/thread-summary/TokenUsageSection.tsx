import { useTranslation } from "react-i18next";
import {
  CircleStackIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

import { formatNumber, formatCompactNumber } from "../../app/locale-format";
import type { v2 } from "../../protocol";

type TokenUsageSectionProps = {
  usage: v2.ThreadTokenUsage | null;
};

export function TokenUsageSection({ usage }: TokenUsageSectionProps) {
  const { t, i18n } = useTranslation("conversation");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";
  const formatTokens = (value: number) => formatNumber(value, locale);
  const formatCompactTokens = (value: number) =>
    formatCompactNumber(value, "en");
  const formatAmount = (value: number) =>
    formatNumber(value, locale, { maximumFractionDigits: 2 });

  if (!usage) {
    return null;
  }

  return (
    <section aria-labelledby="thread-summary-token-usage">
      <h3 className="sr-only" id="thread-summary-token-usage">
        {t("tokenUsage")}
      </h3>
      <dl className="flex min-w-0 items-center gap-2 rounded px-1 py-1 text-xs">
        <dt className="flex shrink-0 items-center gap-1.5 font-medium text-base-content/80">
          <CircleStackIcon aria-hidden="true" className="size-4" />
          <span>{t("tokens")}</span>
        </dt>
        <dd className="ml-auto flex min-w-0 items-center gap-1.5 font-medium tabular-nums">
          <span
            title={t("tokenSummary", {
              input: formatTokens(usage.total.inputTokens),
              output: formatTokens(usage.total.outputTokens),
              total: formatTokens(usage.total.totalTokens),
            })}
          >
            <span aria-hidden="true">
              {formatCompactTokens(usage.total.totalTokens)}
            </span>
            <span className="sr-only">
              {t("tokenSummaryAccessible", {
                input: formatTokens(usage.total.inputTokens),
                output: formatTokens(usage.total.outputTokens),
                total: formatTokens(usage.total.totalTokens),
              })}
            </span>
          </span>
        </dd>
      </dl>
      {usage.totalAmount !== null && (
        <dl className="flex min-w-0 items-center gap-2 rounded px-1 py-1 text-xs">
          <dt className="flex shrink-0 items-center gap-1.5 font-medium text-base-content/80">
            <CurrencyDollarIcon aria-hidden="true" className="size-4" />
            <span>{t("amount")}</span>
          </dt>
          <dd
            className="ml-auto min-w-0 truncate font-medium tabular-nums"
            title={t("totalAmount", {
              amount: formatAmount(usage.totalAmount),
            })}
          >
            <span aria-hidden="true">{formatAmount(usage.totalAmount)}</span>
            <span className="sr-only">
              {t("totalAmountAccessible", {
                amount: formatAmount(usage.totalAmount),
              })}
            </span>
          </dd>
        </dl>
      )}
    </section>
  );
}
