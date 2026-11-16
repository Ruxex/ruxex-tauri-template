import { formatNumber } from "../../app/locale-format";
import { useTranslation } from "react-i18next";
import { CodeBracketIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import type { GitDiffSummary } from "../../platform/git-diff";
import type { v2 } from "../../protocol";
import { getSubagentIdenticon } from "./subagent-identicon";
import type { SubagentRow } from "./subagent-model";
import { TokenUsageSection } from "./TokenUsageSection";

type ThreadSummaryPanelProps = {
  tokenUsage: v2.ThreadTokenUsage | null;
  gitDiff: GitDiffSummary | null;
  subagents?: SubagentRow[];
  onReviewGitDiff?: () => void;
  onOpenTerminal?: () => void;
};

export function ThreadSummaryPanel({
  tokenUsage,
  gitDiff,
  subagents = [],
  onReviewGitDiff,
  onOpenTerminal,
}: ThreadSummaryPanelProps) {
  const { t, i18n } = useTranslation("conversation");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";

  if (!tokenUsage && !gitDiff && subagents.length === 0) {
    return null;
  }

  return (
    <div className="chat-thread-summary-column chat-side-column sticky top-6 z-10 hidden w-full min-w-0 justify-self-end self-start overflow-hidden @container/summary @min-[80rem]/chat:block">
      <aside
        aria-label={t("threadSummary")}
        className="ml-auto hidden h-full w-full max-w-72 rounded-box text-xs @min-[16rem]/summary:block"
        data-testid="thread-summary-panel"
      >
        <div
          className="h-full max-h-full overflow-y-auto"
          data-testid="thread-summary-scroll"
        >
          <div
            className="h-fit overflow-hidden rounded-box bg-base-100 p-4"
            data-testid="thread-summary-content"
          >
            {gitDiff && (
              <section
                aria-label={t("codeChanges")}
                className={tokenUsage || subagents.length > 0 ? "mb-5" : ""}
              >
                {/* Keep change details on one line so the summary stays compact. */}
                <button
                  aria-label={t("reviewChanges", {
                    added: gitDiff.added,
                    deleted: gitDiff.deleted,
                    count: gitDiff.files,
                  })}
                  className="flex w-full min-w-0 items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={onReviewGitDiff}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-1.5 font-medium text-base-content/80">
                    <CodeBracketIcon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                    <span>{t("changes")}</span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 font-medium tabular-nums">
                    <span className="text-success">
                      +{formatNumber(gitDiff.added, locale)}
                    </span>
                    <span className="text-error">
                      −{formatNumber(gitDiff.deleted, locale)}
                    </span>
                    <span className="text-base-content/60">
                      ({formatNumber(gitDiff.files, locale)})
                    </span>
                  </span>
                </button>
              </section>
            )}
            <TokenUsageSection usage={tokenUsage} />
            {subagents.length > 0 && <SubagentsSummary rows={subagents} />}
            {onOpenTerminal && (
              <section aria-label={t("terminal")} className="mt-5">
                <button
                  aria-label={t("openTerminalInRightPane")}
                  className="flex w-full items-center gap-2 rounded px-1 py-1 text-left transition-colors hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
                  onClick={onOpenTerminal}
                  type="button"
                >
                  <CommandLineIcon aria-hidden="true" className="size-4" />
                  <span>{t("terminal")}</span>
                </button>
              </section>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SubagentsSummary({ rows }: { rows: SubagentRow[] }) {
  const { t } = useTranslation("conversation");

  return (
    <details className="mt-5">
      <summary className="cursor-pointer rounded px-1 py-1 hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-medium text-base-content/80">
            {t("subagents")}
          </span>
          <span className="ml-auto flex min-w-0 flex-wrap justify-end gap-1">
            {rows.map((row) => (
              <SubagentIdenticon key={row.threadId} threadId={row.threadId} />
            ))}
          </span>
        </span>
      </summary>
      <ul
        aria-label={t("subagentList")}
        className="mt-2 max-h-48 overflow-y-auto overscroll-contain rounded focus-visible:outline-2 focus-visible:outline-primary"
      >
        {rows.map((row) => (
          <li key={row.threadId}>
            <button
              aria-label={t("subagentLabel", { name: row.label })}
              className="w-full cursor-pointer truncate rounded px-2 py-1 text-left text-xs hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
              type="button"
            >
              {row.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

function SubagentIdenticon({ threadId }: { threadId: string }) {
  const identicon = getSubagentIdenticon(threadId);

  return (
    <span
      aria-hidden="true"
      className="inline-block size-5 shrink-0"
      style={{
        backgroundColor: identicon.color,
        maskImage: `url("${identicon.url}")`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: `url("${identicon.url}")`,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
