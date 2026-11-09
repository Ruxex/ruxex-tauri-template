import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type ExecutionStatusIconProps = {
  status?: string;
  exitCode?: string;
};

export function ExecutionStatusIcon({
  status,
  exitCode,
}: ExecutionStatusIconProps) {
  const hasExitCode = exitCode !== undefined && exitCode !== "";
  const showExitCode = hasExitCode && !(status === "completed" && exitCode === "0");

  if (!status && !showExitCode) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2">
      {status && <StatusIcon status={status} />}
      {showExitCode && <ExitCodeIcon exitCode={exitCode} />}
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "inProgress" || status === "running") {
    return (
      <span
        aria-label="Command running"
        className="inline-flex size-4 shrink-0 items-center justify-center text-primary"
        role="img"
        title="Command running"
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
        aria-label="Command completed"
        className="inline-flex size-4 shrink-0 items-center justify-center text-success"
        role="img"
        title="Command completed"
      >
        <CheckCircleIcon aria-hidden="true" className="size-4" />
      </span>
    );
  }

  return (
    <span
      aria-label={status === "failed" ? "Command failed" : `Command status: ${status}`}
      className="inline-flex size-4 shrink-0 items-center justify-center text-warning"
      role="img"
      title={status === "failed" ? "Command failed" : `Command status: ${status}`}
    >
      <ExclamationTriangleIcon aria-hidden="true" className="size-4" />
    </span>
  );
}

function ExitCodeIcon({ exitCode }: { exitCode: string }) {
  if (exitCode === "0") {
    return (
      <span
        aria-label="Command exited successfully"
        className="inline-flex size-4 shrink-0 items-center justify-center text-success"
        role="img"
        title="Command exited successfully"
      >
        <CheckCircleIcon aria-hidden="true" className="size-4" />
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
      <span>Exit code: {exitCode}</span>
    </span>
  );
}
