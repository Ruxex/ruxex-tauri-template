import { ChevronDownIcon, CpuChipIcon } from "@heroicons/react/24/outline";

import type { v2 } from "../../protocol";
import { SettingRow, SettingsPanel } from "./SettingsPanel";

type RuntimeSummaryProps = {
  modelCount: number;
  permissionCount: number;
  rateLimitName: string;
  models?: v2.Model[];
};

export function RuntimeSummary({
  modelCount,
  permissionCount,
  rateLimitName,
  models = [],
}: RuntimeSummaryProps) {
  return (
    <SettingsPanel icon={CpuChipIcon} title="Runtime summary">
      <dl className="divide-y divide-base-300 text-sm">
        <details className="group">
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-base-200/60 max-sm:grid-cols-1 max-sm:gap-2 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">Models</span>
            <span className="flex items-center justify-end gap-2 text-right text-primary max-sm:justify-between">
              {modelCount} available
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="space-y-2 border-t border-base-300 px-5 py-3.5">
            {models.length === 0 ? (
              <p className="text-sm text-base-content/70">
                No model information available.
              </p>
            ) : (
              models.map((model) => (
                <article
                  className="border-b border-base-300 pb-2 last:border-b-0 last:pb-0"
                  key={model.id}
                >
                  <p className="font-medium">{model.displayName}</p>
                  <p className="font-mono text-xs text-base-content/60">
                    {model.model}
                  </p>
                  {model.description && (
                    <p className="mt-1 text-xs text-base-content/75">
                      {model.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-base-content/60">
                    Input: {model.inputModalities?.join(", ") || "Unknown"}
                    {(model.supportedReasoningEfforts?.length ?? 0) > 0 &&
                      ` · Reasoning: ${model.supportedReasoningEfforts?.map((effort) => effort.reasoningEffort).join(", ")}`}
                  </p>
                </article>
              ))
            )}
          </div>
        </details>
        <SettingRow label="Permissions">{permissionCount} profiles</SettingRow>
        <SettingRow label="Rate limits">{rateLimitName}</SettingRow>
      </dl>
    </SettingsPanel>
  );
}
