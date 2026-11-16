import { useTranslation } from "react-i18next";
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
  subject,
}: ExecutionStatusSummaryProps) {
  const { t } = useTranslation("conversation");
  const hasExitCode = exitCode !== undefined && exitCode !== "";

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

  if (exitCode === undefined || exitCode === "") {
    return null;
  }

  if (exitCode === "0") {
    return (
      <span
        className="font-mono text-xs text-base-content/70"
        title={t("exitCode0")}
      >
        0
      </span>
    );
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
