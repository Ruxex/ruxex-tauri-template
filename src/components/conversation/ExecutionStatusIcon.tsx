import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

type ExecutionStatusIconProps = {
  status?: string;
  subject?: string;
};

export function ExecutionStatusIcon({
  status,
  subject = "Command",
}: ExecutionStatusIconProps) {
  if (!status) {
    return null;
  }

  if (status === "inProgress" || status === "running") {
    return (
      <span
        aria-label={`${subject} running`}
        className="inline-flex size-4 shrink-0 items-center justify-center text-primary"
        role="img"
        title={`${subject} running`}
      >
        <span
          aria-hidden="true"
          className="loading loading-spinner loading-sm size-4 animate-spin"
        />
      </span>
    );
  }

  if (status === "completed") {
    return (
      <span
        aria-label={`${subject} completed`}
        className="inline-flex size-4 shrink-0 items-center justify-center text-success"
        role="img"
        title={`${subject} completed`}
      >
        <CheckCircleIcon aria-hidden="true" className="size-4" />
      </span>
    );
  }

  return (
    <span
      aria-label={status === "failed" ? `${subject} failed` : `${subject} status: ${status}`}
      className="inline-flex size-4 shrink-0 items-center justify-center text-warning"
      role="img"
      title={status === "failed" ? `${subject} failed` : `${subject} status: ${status}`}
    >
      <ExclamationTriangleIcon aria-hidden="true" className="size-4" />
    </span>
  );
}
