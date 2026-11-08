import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";

import type { v2 } from "../../protocol";
import { useCloseDropdownOnOutsidePointerDown } from "./useCloseDropdown";

type ComposerSettingsProps = {
  collaborationModes?: v2.CollaborationModeMask[];
  collaborationModeName?: string;
  disabled: boolean;
  effort: string;
  model: string;
  models: v2.Model[];
  onEffortChange: (effort: string) => void;
  onCollaborationModeChange?: (modeName: string) => void;
  onModelChange: (model: string) => void;
};

export function ComposerSettings({
  collaborationModes = [],
  collaborationModeName = "",
  disabled,
  effort,
  model,
  models,
  onEffortChange,
  onCollaborationModeChange,
  onModelChange,
}: ComposerSettingsProps) {
  const visibleModels = models.filter((item) => !item.hidden);
  const selectedModel =
    visibleModels.find((item) => item.model === model) ??
    visibleModels.find((item) => item.isDefault);
  const modelLabel = selectedModel?.displayName ?? "No model available";
  const effortLabel = effort || "medium";
  const availableEfforts = selectedModel?.supportedReasoningEfforts ?? [];
  const detailsRef = useCloseDropdownOnOutsidePointerDown();

  return (
    <details className="dropdown dropdown-top dropdown-end" ref={detailsRef}>
      <summary
        aria-label="Model and effort"
        className={`btn btn-ghost btn-sm max-w-64 gap-1 ${selectedModel ? "" : "text-base-content/60"}`}
      >
        <AdjustmentsHorizontalIcon aria-hidden="true" className="size-4" />
        <span className="truncate">{modelLabel}</span>
        <span aria-hidden="true" className="text-base-content/50">
          ·
        </span>
        <span className="truncate text-base-content/70">{effortLabel}</span>
      </summary>
      <div className="dropdown-content z-20 mb-2 w-64 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg">
        <label className="form-control">
          <span className="label-text text-xs font-medium">Model</span>
          <select
            aria-label="Model"
            className="select select-bordered select-sm mt-1"
            disabled={disabled}
            onChange={(event) => {
              onModelChange(event.target.value);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            value={model}
          >
            {visibleModels.map((item) => (
              <option key={item.id} value={item.model}>
                {item.displayName}
              </option>
            ))}
            {!visibleModels.length && (
              <option disabled value="">
                No models available
              </option>
            )}
          </select>
        </label>
        <label className="form-control mt-3">
          <span className="label-text text-xs font-medium">Effort</span>
          <select
            aria-label="Effort"
            className="select select-bordered select-sm mt-1"
            disabled={disabled}
            onChange={(event) => {
              onEffortChange(event.target.value);
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            value={effort}
          >
            {availableEfforts.map((option) => (
              <option
                key={option.reasoningEffort}
                value={option.reasoningEffort}
              >
                {option.reasoningEffort}
              </option>
            ))}
            {!availableEfforts.length && (
              <option disabled value="">
                No efforts available
              </option>
            )}
          </select>
        </label>
        {collaborationModes.length > 0 && onCollaborationModeChange && (
          <label className="form-control mt-3">
            <span className="label-text text-xs font-medium">
              Collaboration mode
            </span>
            <select
              aria-label="Collaboration mode"
              className="select select-bordered select-sm mt-1"
              disabled={disabled}
              onChange={(event) => {
                onCollaborationModeChange(event.target.value);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              value={collaborationModeName}
            >
              <option value="">Default</option>
              {collaborationModes.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                  {(!option.mode || !option.model) && " (server default)"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </details>
  );
}
