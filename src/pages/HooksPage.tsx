import { useTranslation } from "react-i18next";
import { i18n } from "@/app/i18n";
import { ShieldCheckIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import { useAppServerStatus } from "@/app-server/queries";
import { formatNumber } from "@/app/locale-format";
import { formatErrorMessage } from "@/app/error-message";
import { useHooksList } from "@/app-server/hooks";
import { EmptyState, ErrorState, LoadingState } from "@/components/base/common/AsyncState";
import { SettingsPanel } from "@/components/feature/settings/SettingsCards";
import type { v2 } from "@/protocol";

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
  system: "system",
  user: "user",
  project: "project",
  mdm: "mdm",
  sessionFlags: "sessionFlags",
  plugin: "plugin",
  cloudRequirements: "cloudRequirements",
  cloudManagedConfig: "cloudManagedConfig",
  unknown: "unknownSource",
};

const HANDLER_LABELS: Record<v2.HookHandlerType, string> = {
  command: "command",
  mcpTool: "mcpTool",
  prompt: "prompt",
  agent: "agent",
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
      return {
        label: i18n.t("managed", {
          ns: "capabilities",
          lng: i18n.resolvedLanguage,
        }),
        tone: "neutral",
      };
    case "trusted":
      return {
        label: i18n.t("trusted", {
          ns: "capabilities",
          lng: i18n.resolvedLanguage,
        }),
        tone: "success",
      };
    case "modified":
      return {
        label: i18n.t("modifiedReviewRequired", {
          ns: "capabilities",
          lng: i18n.resolvedLanguage,
        }),
        tone: "error",
      };
    case "untrusted":
      return {
        label: i18n.t("reviewRequired", {
          ns: "capabilities",
          lng: i18n.resolvedLanguage,
        }),
        tone: "warning",
      };
  }
}

function HandlerValue({ hook }: { hook: v2.HookMetadata }) {
  const { t } = useTranslation("capabilities");
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
      return <span className="text-sm text-base-content/70">{t("modelPromptHook")}</span>;
    case "agent":
      return <span className="text-sm text-base-content/70">{t("agentHook")}</span>;
  }
}

function HookDetails({ hook }: { hook: v2.HookMetadata }) {
  const { t, i18n } = useTranslation("capabilities");
  const trust = trustLabel(hook.trustStatus);
  const executionMode = hook.handlerType === "command" && hook.async ? t("async") : "";

  return (
    <div className="border-t border-base-300 bg-base-100/60 px-5 py-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)]">
        <dt className="font-medium text-base-content/60">{t("handler")}</dt>
        <dd className="min-w-0">
          <HandlerValue hook={hook} />
        </dd>
        <dt className="font-medium text-base-content/60">{t("matcher")}</dt>
        <dd className="min-w-0 break-words">{hook.matcher ?? t("allMatchingEvents")}</dd>
        <dt className="font-medium text-base-content/60">{t("sourcePath")}</dt>
        <dd className="min-w-0 break-all font-mono text-xs" title={hook.sourcePath}>
          {hook.sourcePath}
        </dd>
        {hook.pluginId && (
          <>
            <dt className="font-medium text-base-content/60">{t("plugin")}</dt>
            <dd className="min-w-0 break-words">{hook.pluginId}</dd>
          </>
        )}
        <dt className="font-medium text-base-content/60">{t("trust")}</dt>
        <dd>
          <Badge tone={trust.tone}>{trust.label}</Badge>
        </dd>
        <dt className="font-medium text-base-content/60">{t("timeout")}</dt>
        <dd>
          {t("hookTimeout", {
            seconds: formatNumber(hook.timeoutSec, i18n.resolvedLanguage === "ja" ? "ja" : "en"),
            mode: executionMode,
          })}
        </dd>
        {hook.statusMessage && (
          <>
            <dt className="font-medium text-base-content/60">{t("statusMessage")}</dt>
            <dd className="min-w-0 break-words">{hook.statusMessage}</dd>
          </>
        )}
        {hook.additionalContextLimit !== null && (
          <>
            <dt className="font-medium text-base-content/60">{t("contextLimit")}</dt>
            <dd>{t("hookTokenLimit", { count: hook.additionalContextLimit })}</dd>
          </>
        )}
        <dt className="font-medium text-base-content/60">{t("currentHash")}</dt>
        <dd className="min-w-0 break-all font-mono text-xs">{hook.currentHash}</dd>
      </dl>
    </div>
  );
}

function HookRow({ hook }: { hook: v2.HookMetadata }) {
  const { t } = useTranslation("capabilities");
  const trust = trustLabel(hook.trustStatus);

  return (
    <details className="group">
      <summary
        aria-label={`${EVENT_LABELS[hook.eventName]} ${t(HANDLER_LABELS[hook.handlerType])}`}
        className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 transition-colors hover:bg-base-200/60 [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="text-base-content/50 transition-transform group-open:rotate-90">
          ▸
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{EVENT_LABELS[hook.eventName]}</span>
            <Badge>{t(HANDLER_LABELS[hook.handlerType])}</Badge>
            {hook.matcher && <Badge>{hook.matcher}</Badge>}
          </span>
          <span className="mt-1 block truncate text-xs text-base-content/60">{hook.sourcePath}</span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Badge>{t(SOURCE_LABELS[hook.source])}</Badge>
          <Badge tone={hook.enabled ? "success" : "neutral"}>{hook.enabled ? t("enabled") : t("disabled")}</Badge>
          <Badge tone={trust.tone}>{trust.label}</Badge>
        </span>
      </summary>
      <HookDetails hook={hook} />
    </details>
  );
}

function HookGroup({ entry }: { entry: v2.HooksListEntry }) {
  const { t } = useTranslation("capabilities");
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
            <p className="alert alert-error py-2" key={`${error.path}-${error.message}`}>
              <span>{error.message}</span>
              <span className="min-w-0 break-all text-xs opacity-75">{error.path}</span>
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
        <p className="px-5 py-4 text-sm text-base-content/60">{t("noHooksInThisDirectory")}</p>
      )}
    </SettingsPanel>
  );
}

export function HooksPage() {
  const { t } = useTranslation("capabilities");
  const appServerStatus = useAppServerStatus();
  const homeDataDir = appServerStatus.data?.homeDataDir;
  const hooks = useHooksList(homeDataDir ? { cwds: [homeDataDir] } : {});
  const entries = hooks.data?.data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold tracking-tight">{t("hooks")}</h2>
      {hooks.isLoading && (
        <div aria-label={t("loadingHooks")} className="flex justify-center py-10" role="status">
          <LoadingState />
        </div>
      )}
      {hooks.isError && (
        <ErrorState
          action={
            <button
              className="btn btn-sm"
              disabled={hooks.isFetching}
              onClick={() => void hooks.refetch()}
              type="button"
            >
              {hooks.isFetching ? t("retrying") : t("retry")}
            </button>
          }
        >
          {hooks.error ? t("hooksLoadError", { details: formatErrorMessage(hooks.error) }) : t("hooksLoadFailed")}
        </ErrorState>
      )}
      {!hooks.isLoading && !hooks.isError && entries.length === 0 && (
        <EmptyState icon={ShieldCheckIcon} title={t("noHooksConfigured")} />
      )}
      {!hooks.isLoading && !hooks.isError && entries.length > 0 && (
        <div className="space-y-6">
          {entries.map((entry) => (
            <HookGroup entry={entry} key={entry.cwd} />
          ))}
        </div>
      )}
    </div>
  );
}
