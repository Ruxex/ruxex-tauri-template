import {
  ArrowPathIcon,
  CheckIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ExclamationCircleIcon,
  FolderOpenIcon,
  PauseIcon,
} from "@heroicons/react/24/outline";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/app/locale-format";
import type { GitDiffSummary } from "@/platform/git-diff";
import type { GitHubThreadLink } from "@/platform/github";
import type { v2 } from "@/protocol";
import { getSubagentIdenticon } from "./subagent-identicon";
import type { SubagentRow } from "./subagent-model";
import { TokenUsageSection } from "./TokenUsageSection";
import { ThreadPullRequestAction } from "./ThreadPullRequestAction";

type ThreadSummaryPanelProps = {
  tokenUsage: v2.ThreadTokenUsage | null;
  gitDiff: GitDiffSummary | null;
  subagents?: SubagentRow[];
  onReviewGitDiff?: () => void;
  onOpenTerminal?: () => void;
  onOpenWorkspace?: () => void;
  onOpenEditor?: () => Promise<void>;
  onOpenSubagent?: (target: { threadId: string; label: string }) => void;
  branch?: string | null;
  isLinkedWorktree?: boolean;
  githubLinks?: GitHubThreadLink[];
  onOpenGitHubLink?: (link: GitHubThreadLink) => void;
  workspacePath?: string | null;
  threadId?: string;
};

export function ThreadSummaryPanel({
  tokenUsage,
  gitDiff,
  subagents = [],
  onReviewGitDiff,
  onOpenTerminal,
  onOpenWorkspace,
  onOpenEditor,
  onOpenSubagent,
  branch = null,
  isLinkedWorktree = false,
  githubLinks = [],
  onOpenGitHubLink,
  workspacePath = null,
  threadId,
}: ThreadSummaryPanelProps) {
  const { t, i18n } = useTranslation("conversation");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";
  const [editorError, setEditorError] = useState(false);

  return (
    <div className="chat-thread-summary-column chat-side-column sticky top-6 z-10 hidden w-full min-w-0 justify-self-end self-start overflow-hidden @container/summary @min-[80rem]/chat:block">
      <aside
        aria-label={t("threadSummary")}
        className="ml-auto hidden h-full w-full max-w-72 rounded-box text-xs @min-[16rem]/summary:block"
        data-testid="thread-summary-panel"
      >
        <div className="h-full max-h-full overflow-y-auto" data-testid="thread-summary-scroll">
          <div className="h-fit overflow-hidden rounded-box bg-base-100 p-4" data-testid="thread-summary-content">
            {(branch || isLinkedWorktree) && (
              <section aria-label={t("gitCheckout")} className="mb-5 border-b border-base-300 pb-3">
                <h2 className="font-medium text-base-content/80">{t("gitCheckout")}</h2>
                {branch && (
                  <p className="mt-1 truncate" title={branch}>
                    {t("branchName", { branch })}
                  </p>
                )}
                <p className="mt-1 text-base-content/60">
                  {isLinkedWorktree ? t("linkedWorktree") : t("mainCheckout")}
                </p>
              </section>
            )}
            {githubLinks.length > 0 && (
              <section aria-label={t("githubLinks")} className="mb-5 border-b border-base-300 pb-3">
                <h2 className="font-medium text-base-content/80">{t("githubLinks")}</h2>
                <ul className="mt-1 space-y-1">
                  {githubLinks.map((link) => (
                    <li
                      key={`${link.object.kind}:${link.object.repository.host}/${link.object.repository.owner}/${link.object.repository.name}#${link.object.number}`}
                    >
                      <button
                        className="w-full truncate rounded px-1 py-1 text-left text-primary hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => onOpenGitHubLink?.(link)}
                        type="button"
                      >
                        {link.object.kind === "issue"
                          ? t("issueReference")
                          : t("pullRequestReference", { number: link.object.number })}
                        {link.object.kind === "issue" ? ` #${link.object.number}` : ""}
                        <span className="ml-1 text-base-content/60">
                          {link.object.repository.owner}/{link.object.repository.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {workspacePath && threadId && <ThreadPullRequestAction workspace={workspacePath} threadId={threadId} />}
            {gitDiff && (
              <section aria-label={t("codeChanges")} className={tokenUsage || subagents.length > 0 ? "mb-5" : ""}>
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
                    <CodeBracketIcon aria-hidden="true" className="size-4 shrink-0" />
                    <span>{t("changes")}</span>
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 font-medium tabular-nums">
                    <span className="text-success">+{formatNumber(gitDiff.added, locale)}</span>
                    <span className="text-error">−{formatNumber(gitDiff.deleted, locale)}</span>
                    <span className="text-base-content/60">({formatNumber(gitDiff.files, locale)})</span>
                  </span>
                </button>
              </section>
            )}
            <TokenUsageSection usage={tokenUsage} />
            {subagents.length > 0 && <SubagentsSummary onOpenSubagent={onOpenSubagent} rows={subagents} />}
            {(onOpenTerminal || onOpenWorkspace || onOpenEditor) && (
              <section
                aria-label={t("workspaceActions")}
                className="mt-5 grid grid-cols-3 gap-1 border-t border-base-300 pt-3"
              >
                {onOpenTerminal && (
                  <ThreadSummaryActionButton label={t("openTerminal")} tooltipAlign="left" onClick={onOpenTerminal}>
                    <CommandLineIcon aria-hidden="true" className="size-4" />
                  </ThreadSummaryActionButton>
                )}
                {onOpenWorkspace && (
                  <ThreadSummaryActionButton label={t("openFolder")} tooltipAlign="center" onClick={onOpenWorkspace}>
                    <FolderOpenIcon aria-hidden="true" className="size-4" />
                  </ThreadSummaryActionButton>
                )}
                {onOpenEditor && (
                  <ThreadSummaryActionButton
                    label={t("openInEditor")}
                    tooltipAlign="right"
                    onClick={() => {
                      setEditorError(false);
                      void onOpenEditor().catch(() => setEditorError(true));
                    }}
                  >
                    <CodeBracketIcon aria-hidden="true" className="size-4" />
                  </ThreadSummaryActionButton>
                )}
              </section>
            )}
            {editorError && (
              <p className="mt-2 text-xs text-error" role="alert">
                {t("unableToOpenEditor")}
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function ThreadSummaryActionButton({
  children,
  label,
  onClick,
  tooltipAlign,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tooltipAlign: "left" | "center" | "right";
}) {
  const tooltipPosition = {
    left: "left-0",
    center: "left-1/2 -translate-x-1/2",
    right: "right-0",
  }[tooltipAlign];

  return (
    <span className="group relative flex justify-center">
      <button aria-label={label} className="btn btn-ghost btn-sm btn-square" onClick={onClick} type="button">
        {children}
      </button>
      <span
        className={`invisible absolute bottom-full z-20 w-max max-w-52 rounded-box border border-base-300 bg-base-100 px-2 py-1 text-center text-xs leading-tight text-base-content opacity-0 shadow-lg group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${tooltipPosition}`}
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}

function SubagentsSummary({
  rows,
  onOpenSubagent,
}: {
  rows: SubagentRow[];
  onOpenSubagent?: (target: { threadId: string; label: string }) => void;
}) {
  const { t, i18n } = useTranslation("conversation");
  const locale = i18n.resolvedLanguage === "ja" ? "ja" : "en";

  return (
    <details className="collapse collapse-arrow mt-5" open>
      <summary className="collapse-title flex min-h-0 cursor-pointer items-center rounded px-1 py-1 pr-7 text-xs hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 font-medium text-base-content/80">{t("subagents")}</span>
          <span className="ml-auto shrink-0 tabular-nums text-base-content/60">
            ({formatNumber(rows.length, locale)})
          </span>
        </span>
      </summary>
      <div className="collapse-content px-0 pb-0 pt-2">
        <ul
          aria-label={t("subagentList")}
          className="max-h-48 overflow-y-auto overscroll-contain rounded focus-visible:outline-2 focus-visible:outline-primary"
        >
          {rows.map((row) => (
            <li key={row.threadId}>
              <button
                aria-label={t("openSubagent", { name: row.label })}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
                disabled={!onOpenSubagent}
                onClick={() => onOpenSubagent?.({ threadId: row.threadId, label: row.label })}
                type="button"
              >
                <SubagentIdenticon threadId={row.threadId} />
                <span className="min-w-0 flex-1 truncate text-base-content/90">{row.label}</span>
                <SubagentStatusIndicator status={row.status} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function SubagentStatusIndicator({ status }: { status: SubagentRow["status"] }) {
  const { t } = useTranslation("conversation");
  const statusLabel = t(
    status === "active"
      ? "subagentRunning"
      : status === "done"
        ? "subagentCompleted"
        : status === "failed"
          ? "failed"
          : "interrupted",
  );

  return (
    <span aria-label={statusLabel} className="shrink-0" role="img" title={statusLabel}>
      {status === "active" ? (
        <ArrowPathIcon
          aria-hidden="true"
          className="size-4 motion-safe:animate-spin motion-reduce:animate-none text-primary"
        />
      ) : status === "done" ? (
        <CheckIcon aria-hidden="true" className="size-4 text-success" />
      ) : status === "failed" ? (
        <ExclamationCircleIcon aria-hidden="true" className="size-4 text-error" />
      ) : (
        <PauseIcon aria-hidden="true" className="size-4 text-base-content/55" />
      )}
    </span>
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
