import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import { StateBadge } from "../common/StateBadge";

type BrowserComputerUseCardProps = {
  config: {
    browser_use?: unknown;
    computer_use?: unknown;
  } | null;
  requirements: {
    allowBrowserAndComputerUse?: boolean | null;
    browserUse?: unknown;
    computerUse?: unknown;
  } | null;
};

export function BrowserComputerUseCard({
  config,
  requirements,
}: BrowserComputerUseCardProps) {
  const disabledByPolicy = requirements?.allowBrowserAndComputerUse === false;
  const browserAvailable =
    !disabledByPolicy && requirements?.browserUse != null;
  const computerAvailable =
    !disabledByPolicy && requirements?.computerUse != null;

  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title">Browser and Computer Use</h2>
        {disabledByPolicy && (
          <StateBadge icon={ExclamationTriangleIcon} tone="warning">
            Disabled by policy
          </StateBadge>
        )}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <StatusRow
            label="Browser use"
            available={browserAvailable}
            configured={config?.browser_use != null}
          />
          <StatusRow
            label="Computer use"
            available={computerAvailable}
            configured={config?.computer_use != null}
          />
        </dl>
      </div>
    </article>
  );
}
function StatusRow({
  label,
  available,
  configured,
}: {
  label: string;
  available: boolean;
  configured: boolean;
}) {
  return (
    <div className="rounded-box bg-base-200 p-3">
      <dt className="font-medium">{label}</dt>
      <dd className="mt-2 flex flex-wrap gap-1.5">
        <StateBadge
          icon={available ? CheckCircleIcon : XCircleIcon}
          tone={available ? "success" : "error"}
        >
          {available ? "Available" : "Unavailable"}
        </StateBadge>
        <StateBadge
          icon={configured ? CheckCircleIcon : ExclamationTriangleIcon}
          tone={configured ? "success" : "warning"}
        >
          {configured ? "Configured" : "Not configured"}
        </StateBadge>
      </dd>
    </div>
  );
}
