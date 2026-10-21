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
        <p className="text-sm text-base-content/70">
          App Server owns execution, approvals, and tool results; this client
          only presents the capability state and screenshots.
        </p>
        {disabledByPolicy && (
          <p className="badge badge-warning">Disabled by policy</p>
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
      <dd className="mt-1 text-base-content/70">
        <span>{available ? "Available" : "Unavailable"}</span>
        <span> · </span>
        <span>{configured ? "Configured" : "Not configured"}</span>
      </dd>
    </div>
  );
}
