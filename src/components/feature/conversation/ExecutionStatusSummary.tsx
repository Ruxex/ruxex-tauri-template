import { useTranslation } from "react-i18next";
import { XCircleIcon } from "@heroicons/react/24/outline";

import { ExecutionStatusIcon } from "./ExecutionStatusIcon";

type ExecutionStatusSummaryProps = {
  status?: string;
  exitCode?: string;
  subject?: string;
};

export function ExecutionStatusSummary({ status, exitCode, subject }: ExecutionStatusSummaryProps) {
  const { t } = useTranslation("conversation");
  const hasExitCode = hasNonZeroExitCode(exitCode);

  if (!status && !hasExitCode) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <ExecutionStatusIcon status={status} subject={subject ?? t("command")} />
      <ExitCodeDisplay exitCode={exitCode} />
    </span>
  );
}

export function ExitCodeDisplay({ exitCode }: { exitCode?: string }) {
  const { t } = useTranslation("conversation");

  if (!hasNonZeroExitCode(exitCode)) {
    return null;
  }

  return (
    <span
      aria-label={t("commandExit", { code: exitCode })}
      className="inline-flex shrink-0 items-center gap-1 text-error"
      role="img"
      title={t("commandExit", { code: exitCode })}
    >
      <XCircleIcon aria-hidden="true" className="size-4" />
      <span>{exitCode}</span>
    </span>
  );
}

function hasNonZeroExitCode(exitCode?: string): boolean {
  return exitCode !== undefined && exitCode.trim() !== "" && Number(exitCode) !== 0;
}
