import {
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

import { useHooksList } from "../app-server/hooks";
import { formatErrorMessage } from "../app/error-message";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../components/common/AsyncState";
import { SettingsPanel } from "../components/settings/SettingsCards";
import type { v2 } from "../protocol";

const EVENT_LABELS: Record<v2.HookEventName, string> = {
  preToolUse: "PreToolUse",
  permissionRequest: "PermissionRequest",
  postToolUse: "PostToolUse",
  preCompact: "PreCompact",
  postCompact: "PostCompact",
  sessionStart: "SessionStart",
  sessionEnd: "SessionEnd",
  userPromptSubmit: "UserPromptSubmit",
  subagentStart: "SubagentStart",
  subagentStop: "SubagentStop",
  stop: "Stop",
  interrupt: "Interrupt",
};

const SOURCE_LABELS: Record<v2.HookSource, string> = {
  system: "System",
  user: "User",
  project: "Project",
  mdm: "MDM",
  sessionFlags: "Session flags",
  plugin: "Plugin",
  cloudRequirements: "Cloud requirements",
  cloudManagedConfig: "Cloud-managed config",
  unknown: "Unknown source",
};

const HANDLER_LABELS: Record<v2.HookHandlerType, string> = {
  command: "Command",
  mcpTool: "MCP tool",
  prompt: "Prompt",
  agent: "Agent",
};

function Badge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  const toneClass = {
    neutral: "badge-ghost",
    success: "badge-success badge-outline",
    warning: "badge-warning badge-outline",
    error: "badge-error badge-outline",
  }[tone];

  return <span className={`badge badge-sm ${toneClass}`}>{children}</span>;
}

function trustLabel(status: v2.HookTrustStatus): {
  label: string;
  tone: "neutral" | "success" | "warning" | "error";
} {
  switch (status) {
    case "managed":
      return { label: "Managed", tone: "neutral" };
    case "trusted":
      return { label: "Trusted", tone: "success" };
    case "modified":
      return { label: "Modified — review required", tone: "error" };
    case "untrusted":
      return { label: "Review required", tone: "warning" };
  }
}

function HandlerValue({ hook }: { hook: v2.HookMetadata }) {
  switch (hook.handlerType) {
    case "command":
      return (
        <code className="block max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-box bg-base-200 px-3 py-2 text-left text-xs">
          {hook.command}
        </code>
      );
    case "mcpTool":
      return (
        <code className="block max-w-full overflow-x-auto whitespace-pre-wrap break-all rounded-box bg-base-200 px-3 py-2 text-left text-xs">
          {hook.server} · {hook.tool}
        </code>
      );
    case "prompt":
      return (
        <span className="text-sm text-base-content/70">Model prompt hook</span>
      );
    case "agent":
      return <span className="text-sm text-base-content/70">Agent hook</span>;
  }
}

function HookDetails({ hook }: { hook: v2.HookMetadata }) {
  const trust = trustLabel(hook.trustStatus);
  const executionMode =
    hook.handlerType === "command" && hook.async ? " · async" : "";

  return (
    <div className="border-t border-base-300 bg-base-100/60 px-5 py-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)]">
        <dt className="font-medium text-base-content/60">Handler</dt>
        <dd className="min-w-0">
          <HandlerValue hook={hook} />
        </dd>
        <dt className="font-medium text-base-content/60">Matcher</dt>
        <dd className="min-w-0 break-words">
          {hook.matcher ?? "All matching events"}
        </dd>
        <dt className="font-medium text-base-content/60">Source path</dt>
        <dd
          className="min-w-0 break-all font-mono text-xs"
          title={hook.sourcePath}
        >
          {hook.sourcePath}
        </dd>
        {hook.pluginId && (
          <>
            <dt className="font-medium text-base-content/60">Plugin</dt>
            <dd className="min-w-0 break-words">{hook.pluginId}</dd>
          </>
        )}
        <dt className="font-medium text-base-content/60">Trust</dt>
        <dd>
          <Badge tone={trust.tone}>{trust.label}</Badge>
        </dd>
        <dt className="font-medium text-base-content/60">Timeout</dt>
        <dd>
          {String(hook.timeoutSec)}s{executionMode}
        </dd>
        {hook.statusMessage && (
          <>
            <dt className="font-medium text-base-content/60">Status message</dt>
            <dd className="min-w-0 break-words">{hook.statusMessage}</dd>
          </>
        )}
        {hook.additionalContextLimit !== null && (
          <>
            <dt className="font-medium text-base-content/60">Context limit</dt>
            <dd>{hook.additionalContextLimit.toLocaleString()} tokens</dd>
          </>
        )}
        <dt className="font-medium text-base-content/60">Current hash</dt>
        <dd className="min-w-0 break-all font-mono text-xs">
          {hook.currentHash}
        </dd>
      </dl>
    </div>
  );
}

function HookRow({ hook }: { hook: v2.HookMetadata }) {
  const trust = trustLabel(hook.trustStatus);

  return (
    <details className="group">
      <summary
        aria-label={`${EVENT_LABELS[hook.eventName]} ${HANDLER_LABELS[hook.handlerType]}`}
        className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 transition-colors hover:bg-base-200/60 [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className="text-base-content/50 transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{EVENT_LABELS[hook.eventName]}</span>
            <Badge>{HANDLER_LABELS[hook.handlerType]}</Badge>
            {hook.matcher && <Badge>{hook.matcher}</Badge>}
          </span>
          <span className="mt-1 block truncate text-xs text-base-content/60">
            {hook.sourcePath}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Badge>{SOURCE_LABELS[hook.source]}</Badge>
          <Badge tone={hook.enabled ? "success" : "neutral"}>
            {hook.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <Badge tone={trust.tone}>{trust.label}</Badge>
        </span>
      </summary>
      <HookDetails hook={hook} />
    </details>
  );
}

function HookGroup({ entry }: { entry: v2.HooksListEntry }) {
  return (
    <SettingsPanel title={entry.cwd} icon={WrenchScrewdriverIcon}>
      {(entry.warnings.length > 0 || entry.errors.length > 0) && (
        <div className="space-y-2 px-5 py-4 text-sm">
          {entry.warnings.map((warning) => (
            <p className="alert alert-warning py-2" key={warning}>
              {warning}
            </p>
          ))}
          {entry.errors.map((error) => (
            <p
              className="alert alert-error py-2"
              key={`${error.path}-${error.message}`}
            >
              <span>{error.message}</span>
              <span className="min-w-0 break-all text-xs opacity-75">
                {error.path}
              </span>
            </p>
          ))}
        </div>
      )}
      {entry.hooks.length > 0 ? (
        <div className="divide-y divide-base-300">
          {entry.hooks.map((hook) => (
            <HookRow key={hook.key} hook={hook} />
          ))}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-base-content/60">
          No hooks in this directory.
        </p>
      )}
    </SettingsPanel>
  );
}

export function HooksPage() {
  const hooks = useHooksList();
  const entries = hooks.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight">Hooks</h2>
        <p className="mt-2 text-sm text-base-content/60">
          Read-only view of lifecycle hooks discovered by the App Server. Review
          or edit the source configuration outside the desktop app.
        </p>
      </div>
      {hooks.isLoading && (
        <div
          aria-label="Loading hooks"
          className="flex justify-center py-10"
          role="status"
        >
          <LoadingState />
        </div>
      )}
      {hooks.isError && (
        <ErrorState>
          Unable to load hooks
          {hooks.error ? `: ${formatErrorMessage(hooks.error)}` : "."}
        </ErrorState>
      )}
      {!hooks.isLoading && !hooks.isError && entries.length === 0 && (
        <EmptyState icon={ShieldCheckIcon} title="No hooks configured." />
      )}
      {!hooks.isLoading && !hooks.isError && entries.length > 0 && (
        <div className="space-y-5">
          {entries.map((entry) => (
            <HookGroup entry={entry} key={entry.cwd} />
          ))}
        </div>
      )}
    </div>
  );
}
