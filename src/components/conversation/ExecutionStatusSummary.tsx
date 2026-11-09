import { XCircleIcon } from "@heroicons/react/24/outline";

import { ExecutionStatusIcon } from "./ExecutionStatusIcon";

type ExecutionStatusSummaryProps = {
  status?: string;
  exitCode?: string;
  subject?: string;
};

export function ExecutionStatusSummary({
  status,
  exitCode,
  subject = "Command",
}: ExecutionStatusSummaryProps) {
  const hasExitCode = exitCode !== undefined && exitCode !== "";

  if (!status && !hasExitCode) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <ExecutionStatusIcon status={status} subject={subject} />
      <ExitCodeDisplay exitCode={exitCode} />
    </span>
  );
}

export function ExitCodeDisplay({ exitCode }: { exitCode?: string }) {
  if (exitCode === undefined || exitCode === "") {
    return null;
  }

  if (exitCode === "0") {
    return (
      <span
        className="font-mono text-xs text-base-content/70"
        title="Exit code 0"
      >
        0
      </span>
    );
  }

  return (
    <span
      aria-label={`Command exited with code ${exitCode}`}
      className="inline-flex shrink-0 items-center gap-1 text-error"
      role="img"
      title={`Command exited with code ${exitCode}`}
    >
      <XCircleIcon aria-hidden="true" className="size-4" />
      <span>{exitCode}</span>
    </span>
  );
}
