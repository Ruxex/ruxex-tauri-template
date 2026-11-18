import { useTranslation } from "react-i18next";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type ExecutionStatusIconProps = {
  status?: string;
  subject?: string;
};

export function ExecutionStatusIcon({ status, subject }: ExecutionStatusIconProps) {
  const { t } = useTranslation("conversation");
  const resolvedSubject = subject ?? t("command");
  if (!status) {
    return null;
  }

  if (status === "inProgress" || status === "running") {
    return (
      <span
        aria-label={t("subjectRunning", { subject: resolvedSubject })}
        className="inline-flex size-4 shrink-0 items-center justify-center text-primary"
        role="img"
        title={t("subjectRunning", { subject: resolvedSubject })}
      >
        <span aria-hidden="true" className="loading loading-spinner loading-sm size-4 animate-spin" />
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span
        aria-label={t("subjectCompleted", { subject: resolvedSubject })}
        className="inline-flex size-4 shrink-0 items-center justify-center text-success"
        role="img"
        title={t("subjectCompleted", { subject: resolvedSubject })}
      >
        <CheckCircleIcon aria-hidden="true" className="size-4" />
      </span>
    );
  }

  const displayStatus = status === "declined" || status === "interrupted" ? t(`executionStatuses.${status}`) : status;

  return (
    <span
      aria-label={
        status === "failed"
          ? t("subjectFailed", { subject: resolvedSubject })
          : t("subjectStatus", {
              subject: resolvedSubject,
              status: displayStatus,
            })
      }
      className="inline-flex size-4 shrink-0 items-center justify-center text-warning"
      role="img"
      title={
        status === "failed"
          ? t("subjectFailed", { subject: resolvedSubject })
          : t("subjectStatus", {
              subject: resolvedSubject,
              status: displayStatus,
            })
      }
    >
      <ExclamationTriangleIcon aria-hidden="true" className="size-4" />
    </span>
  );
}
