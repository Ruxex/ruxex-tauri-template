import type { v2 } from "../../protocol";

type ComposerSettingsProps = {
  disabled: boolean;
  effort: string;
  model: string;
  models: v2.Model[];
  onEffortChange: (effort: string) => void;
  onModelChange: (model: string) => void;
};

export function ComposerSettings({
  disabled,
  effort,
  model,
  models,
  onEffortChange,
  onModelChange,
}: ComposerSettingsProps) {
  const visibleModels = models.filter((item) => !item.hidden);
  const selectedModel =
    visibleModels.find((item) => item.model === model) ??
    visibleModels.find((item) => item.isDefault);

  return (
    <div className="flex min-w-0 items-center gap-1">
      <select
        aria-label="Model"
        className="select select-ghost select-sm max-w-40"
        disabled={disabled}
        onChange={(event) => onModelChange(event.target.value)}
        value={model}
      >
        <option value="">Default model</option>
        {visibleModels.map((item) => (
          <option key={item.id} value={item.model}>
            {item.displayName}
          </option>
        ))}
      </select>
      <select
        aria-label="Effort"
        className="select select-ghost select-sm max-w-32"
        disabled={disabled}
        onChange={(event) => onEffortChange(event.target.value)}
        value={effort}
      >
        <option value="">Default effort</option>
        {selectedModel?.supportedReasoningEfforts.map((option) => (
          <option key={option.reasoningEffort} value={option.reasoningEffort}>
            {option.reasoningEffort}
          </option>
        ))}
      </select>
    </div>
  );
}
