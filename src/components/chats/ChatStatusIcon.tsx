import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PauseCircleIcon,
  StopCircleIcon,
} from "@heroicons/react/24/outline";

import { type ChatStatus, chatStatusLabel } from "./chat-status";

export function ChatStatusIcon({ status }: { status: ChatStatus }) {
  const label = chatStatusLabel(status);

  return (
    <span
      aria-label={`Chat status: ${label}`}
      className={`inline-flex size-4 shrink-0 items-center justify-center ${statusColorClassName(status)}`}
      role="status"
    >
      {statusIcon(status)}
    </span>
  );
}

function statusColorClassName(status: ChatStatus): string {
  switch (status) {
    case "completed":
      return "text-success";
    case "waiting":
      return "text-warning";
    case "failed":
      return "text-error";
    case "stopped":
      return "text-base-content/50";
    case "running":
      return "text-info";
  }
}

function statusIcon(status: ChatStatus) {
  switch (status) {
    case "running":
      return <span aria-hidden="true" className="loading loading-spinner loading-xs" />;
    case "completed":
      return <CheckCircleIcon aria-hidden="true" className="size-4" />;
    case "waiting":
      return <PauseCircleIcon aria-hidden="true" className="size-4" />;
    case "failed":
      return <ExclamationCircleIcon aria-hidden="true" className="size-4" />;
    case "stopped":
      return <StopCircleIcon aria-hidden="true" className="size-4" />;
  }
}
