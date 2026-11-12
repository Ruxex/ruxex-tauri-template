import { CpuChipIcon } from "@heroicons/react/24/outline";

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
        <SettingRow label="Models">
          <details className="text-left">
            <summary className="cursor-pointer list-none text-right text-primary hover:underline">
              {modelCount} available
            </summary>
            <div className="mt-3 space-y-2 rounded-box border border-base-300 bg-base-200 p-3">
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
        </SettingRow>
        <SettingRow label="Permissions">{permissionCount} profiles</SettingRow>
        <SettingRow label="Rate limits">{rateLimitName}</SettingRow>
      </dl>
    </SettingsPanel>
  );
}
