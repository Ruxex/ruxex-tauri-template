import type { ConversationViewItem } from "./conversation-model";
import { ExecutionStatusSummary } from "./ExecutionStatusSummary";
import type { ActivityPresentation } from "./activity-presentation";

type ActivitySummaryProps = {
  item: ConversationViewItem;
  presentation: ActivityPresentation;
};

export function ActivitySummary({ item, presentation }: ActivitySummaryProps) {
  const Icon = presentation.icon;
  const metadata = item.metadata;
  const isCommandExecution = item.type === "commandExecution";
  const hasCommandExecutionSummary =
    isCommandExecution &&
    (metadata?.status !== undefined || metadata?.exitCode !== undefined);
  const isInProgress =
    metadata?.status === "inProgress" || metadata?.status === "running";
  const summaryClassName = isCommandExecution
    ? "min-h-0 gap-1.5 px-3 py-0.5 pr-8 text-xs"
    : "gap-2 py-3 text-sm";

  return (
    <summary
      className={`collapse-title flex items-center ${summaryClassName} font-medium`}
    >
      <span
        aria-label={presentation.label}
        className="inline-flex size-4 shrink-0 items-center justify-center"
        role="img"
        title={presentation.label}
      >
        <Icon aria-hidden="true" className="size-4 text-base-content/70" />
      </span>
      <span>{item.title}</span>
      {hasCommandExecutionSummary && (
        <ExecutionStatusSummary
          exitCode={metadata?.exitCode}
          status={metadata?.status}
          subject={presentation.label}
        />
      )}
      {!isCommandExecution && isInProgress && (
        <ExecutionStatusSummary
          status={metadata?.status}
          subject={presentation.label}
        />
      )}
      {isInProgress && (
        <span aria-label="Running" className="sr-only" role="status">
          Running
        </span>
      )}
      {!isCommandExecution && (
        <span className="badge badge-ghost badge-sm">
          {presentation.typeLabel}
        </span>
      )}
    </summary>
  );
}
