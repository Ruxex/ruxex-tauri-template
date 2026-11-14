import { CircleStackIcon } from "@heroicons/react/24/outline";

import type { v2 } from "../../protocol";

type TokenUsageSectionProps = {
  usage: v2.ThreadTokenUsage | null;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const compactAmountFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumSignificantDigits: 3,
});
const amountFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 20,
});

function formatTokens(value: number): string {
  return numberFormatter.format(value);
}

function formatCompactTokens(value: number): string {
  return compactNumberFormatter.format(value).toLowerCase();
}

function formatAmount(value: number): string {
  return amountFormatter.format(value);
}

function formatCompactAmount(value: number): string {
  return compactAmountFormatter.format(value).toLowerCase();
}

export function TokenUsageSection({ usage }: TokenUsageSectionProps) {
  if (!usage) {
    return null;
  }

  return (
    <section aria-labelledby="thread-summary-token-usage">
      <h3 className="sr-only" id="thread-summary-token-usage">
        Token Usage
      </h3>
      <dl className="flex min-w-0 items-center gap-2 rounded px-1 py-1 text-xs">
        <dt className="flex shrink-0 items-center gap-1.5 font-medium text-base-content/80">
          <CircleStackIcon aria-hidden="true" className="size-4" />
          <span>Tokens</span>
        </dt>
        <dd className="ml-auto flex min-w-0 items-center gap-1.5 font-medium tabular-nums">
          <span
            title={`Input tokens: ${formatTokens(usage.total.inputTokens)}`}
          >
            <span aria-hidden="true">
              I {formatCompactTokens(usage.total.inputTokens)}
            </span>
            <span className="sr-only">
              Input {formatTokens(usage.total.inputTokens)}
            </span>
          </span>
          <span aria-hidden="true" className="text-base-content/40">
            ·
          </span>
          <span
            title={`Output tokens: ${formatTokens(usage.total.outputTokens)}`}
          >
            <span aria-hidden="true">
              O {formatCompactTokens(usage.total.outputTokens)}
            </span>
            <span className="sr-only">
              Output {formatTokens(usage.total.outputTokens)}
            </span>
          </span>
          <span aria-hidden="true" className="text-base-content/40">
            ·
          </span>
          <span
            className="text-base-content/80"
            title={`Total tokens: ${formatTokens(usage.total.totalTokens)}`}
          >
            <span aria-hidden="true">
              Σ {formatCompactTokens(usage.total.totalTokens)}
            </span>
            <span className="sr-only">
              Total {formatTokens(usage.total.totalTokens)}
            </span>
          </span>
        </dd>
      </dl>
      {usage.totalAmount !== null && (
        <dl className="flex min-w-0 items-center gap-2 rounded px-1 py-1 text-xs">
          <dt className="font-medium text-base-content/80">Amount</dt>
          <dd
            className="ml-auto min-w-0 truncate font-medium tabular-nums"
            title={`Total amount: ${formatAmount(usage.totalAmount)}`}
          >
            <span aria-hidden="true">
              {formatCompactAmount(usage.totalAmount)}
            </span>
            <span className="sr-only">
              Total amount {formatAmount(usage.totalAmount)}
            </span>
          </dd>
        </dl>
      )}
    </section>
  );
}
