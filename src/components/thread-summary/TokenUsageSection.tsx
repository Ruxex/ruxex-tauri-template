import type { v2 } from "../../protocol";

type TokenUsageSectionProps = {
  usage: v2.ThreadTokenUsage | null;
};

const numberFormatter = new Intl.NumberFormat("en-US");

function formatTokens(value: number): string {
  return numberFormatter.format(value);
}

export function TokenUsageSection({ usage }: TokenUsageSectionProps) {
  return (
    <section aria-labelledby="thread-summary-token-usage">
      <h3
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary"
        id="thread-summary-token-usage"
      >
        Token Usage
      </h3>
      {!usage ? (
        <p className="text-base-content/60">No token usage yet.</p>
      ) : (
        <dl className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <dt>Total</dt>
            <dd className="font-medium tabular-nums">
              {formatTokens(usage.total.totalTokens)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt>Latest turn</dt>
            <dd className="font-medium tabular-nums">
              {formatTokens(usage.last.totalTokens)}
            </dd>
          </div>
          <div className="border-t border-base-300 pt-2">
            <div className="mb-1 text-xs uppercase tracking-wide text-base-content/60">
              Total breakdown
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <span>Input</span>
              <span className="text-right tabular-nums">
                {formatTokens(usage.total.inputTokens)}
              </span>
              <span>Output</span>
              <span className="text-right tabular-nums">
                {formatTokens(usage.total.outputTokens)}
              </span>
              <span>Reasoning</span>
              <span className="text-right tabular-nums">
                {formatTokens(usage.total.reasoningOutputTokens)}
              </span>
            </div>
          </div>
          {usage.modelContextWindow !== null && (
            <div className="flex items-center justify-between gap-3 border-t border-base-300 pt-2">
              <dt>Context window</dt>
              <dd className="font-medium tabular-nums">
                {formatTokens(usage.modelContextWindow)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
