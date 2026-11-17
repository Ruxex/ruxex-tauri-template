import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("settings");
  return (
    <SettingsPanel icon={CpuChipIcon} title={t("settings:runtimeSummary")}>
      <dl className="divide-y divide-base-300 text-sm">
        <details className="group">
          <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-base-200/60 max-sm:grid-cols-1 max-sm:gap-2 [&::-webkit-details-marker]:hidden">
            <span className="font-medium">{t("settings:models")}</span>
            <span className="flex items-center justify-end gap-2 text-right text-primary max-sm:justify-between">
              {t("settings:modelsAvailable", { count: modelCount })}
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="space-y-2 border-t border-base-300 px-5 py-3.5">
            {models.length === 0 ? (
              <p className="text-sm text-base-content/70">
                {t("settings:noModels")}
              </p>
            ) : (
              models.map((model) => (
                <article
                  className="border-b border-base-300 pb-2 last:border-b-0 last:pb-0"
                  key={model.id}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="min-w-0 font-medium">{model.displayName}</p>
                    <p className="max-w-full break-all text-right font-mono text-xs text-base-content/60">
                      {model.model}
                    </p>
                  </div>
                  {model.description && (
                    <p className="mt-1 text-xs text-base-content/75">
                      {model.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-base-content/60">
                    {t("settings:modelInput", {
                      modalities:
                        model.inputModalities?.join(", ") ||
                        t("settings:unknown"),
                    })}
                    {(model.supportedReasoningEfforts?.length ?? 0) > 0 &&
                      t("settings:modelReasoning", {
                        efforts: model.supportedReasoningEfforts
                          ?.map((effort) => effort.reasoningEffort)
                          .join(", "),
                      })}
                  </p>
                </article>
              ))
            )}
          </div>
        </details>
        <SettingRow label={t("settings:permissions")}>
          {t("settings:profiles", { count: permissionCount })}
        </SettingRow>
        <SettingRow label={t("settings:rateLimits")}>
          {rateLimitName}
        </SettingRow>
      </dl>
    </SettingsPanel>
  );
}
