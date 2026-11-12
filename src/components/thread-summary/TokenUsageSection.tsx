import type { v2 } from "../../protocol";

type TokenUsageSectionProps = {
  usage: v2.ThreadTokenUsage | null;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatTokens(value: number): string {
  return numberFormatter.format(value);
}

export function TokenUsageSection({ usage }: TokenUsageSectionProps) {
  if (!usage) {
    return null;
  }

  return (
    <section aria-labelledby="thread-summary-token-usage">
      <h3
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary"
        id="thread-summary-token-usage"
      >
        Token Usage
      </h3>
      <dl className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <dt>Input</dt>
          <dd className="font-medium tabular-nums">
            {formatTokens(usage.total.inputTokens)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Output</dt>
          <dd className="font-medium tabular-nums">
            {formatTokens(usage.total.outputTokens)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-base-300 pt-2">
          <dt>Total</dt>
          <dd className="font-medium tabular-nums">
            {formatTokens(usage.total.totalTokens)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
