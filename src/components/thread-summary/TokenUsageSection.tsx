import { CircleStackIcon } from "@heroicons/react/24/outline";

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
      <h3 className="sr-only" id="thread-summary-token-usage">
        Token Usage
      </h3>
      <dl className="flex min-w-0 items-center gap-2 rounded px-1 py-1 text-xs">
        <dt className="flex shrink-0 items-center gap-1.5 font-medium text-base-content/80">
          <CircleStackIcon aria-hidden="true" className="size-4" />
          <span>Tokens</span>
        </dt>
        <dd className="ml-auto flex min-w-0 items-center gap-1.5 font-medium tabular-nums">
          <span title="Input tokens">
            <span aria-hidden="true">
              I {formatTokens(usage.total.inputTokens)}
            </span>
            <span className="sr-only">
              Input {formatTokens(usage.total.inputTokens)}
            </span>
          </span>
          <span aria-hidden="true" className="text-base-content/40">
            ·
          </span>
          <span title="Output tokens">
            <span aria-hidden="true">
              O {formatTokens(usage.total.outputTokens)}
            </span>
            <span className="sr-only">
              Output {formatTokens(usage.total.outputTokens)}
            </span>
          </span>
          <span aria-hidden="true" className="text-base-content/40">
            ·
          </span>
          <span title="Total tokens" className="text-base-content/80">
            <span aria-hidden="true">
              Σ {formatTokens(usage.total.totalTokens)}
            </span>
            <span className="sr-only">
              Total {formatTokens(usage.total.totalTokens)}
            </span>
          </span>
        </dd>
      </dl>
    </section>
  );
}
