import { useEffect, useRef, useState } from "react";

import type { v2 } from "../../protocol";

export const COMPOSER_SELECTION_KEY = "ruxex.chat-composer-selection";

type ComposerSelection = {
  model: string;
  effort: string;
};

function readStoredSelection(): Partial<ComposerSelection> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(COMPOSER_SELECTION_KEY) ?? "null",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const record = parsed as Record<string, unknown>;
    return {
      ...(typeof record.model === "string" ? { model: record.model } : {}),
      ...(typeof record.effort === "string" ? { effort: record.effort } : {}),
    };
  } catch {
    return {};
  }
}

function visibleModels(models: v2.Model[]): v2.Model[] {
  return models.filter((model) => !model.hidden);
}

function findModel(models: v2.Model[], model: string): v2.Model | undefined {
  return visibleModels(models).find((item) => item.model === model);
}

export function defaultEffortForModel(model: v2.Model | undefined): string {
  const efforts = model?.supportedReasoningEfforts ?? [];
  return (
    efforts.find((option) =>
      ["medium", "mid"].includes(option.reasoningEffort.toLowerCase()),
    )?.reasoningEffort ??
    efforts[0]?.reasoningEffort ??
    "medium"
  );
}

function resolveSelection(
  models: v2.Model[],
  requestedModel: string,
  requestedEffort: string,
): ComposerSelection {
  const availableModels = visibleModels(models);
  const selectedModel = findModel(models, requestedModel) ?? availableModels[0];
  const selectedEfforts = selectedModel?.supportedReasoningEfforts ?? [];
  const effort = selectedEfforts.some(
    (option) => option.reasoningEffort === requestedEffort,
  )
    ? requestedEffort
    : defaultEffortForModel(selectedModel);

  return {
    model: selectedModel?.model ?? requestedModel,
    effort,
  };
}

export function useComposerSelection(
  models: v2.Model[],
  initialModel?: string | null,
  initialEffort?: string | null,
) {
  const [selection, setSelection] = useState<ComposerSelection>({
    model: initialModel ?? "",
    effort: initialEffort ?? "",
  });
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || models.length === 0) {
      return;
    }
    const stored = readStoredSelection();
    setSelection(
      resolveSelection(
        models,
        initialModel || stored.model || "",
        initialEffort || stored.effort || "",
      ),
    );
    initialized.current = true;
  }, [initialEffort, initialModel, models]);

  useEffect(() => {
    if (!initialized.current || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      COMPOSER_SELECTION_KEY,
      JSON.stringify(selection),
    );
  }, [selection]);

  function setModel(model: string) {
    setSelection((current) => {
      const selectedModel = findModel(models, model);
      const supportedEfforts = selectedModel?.supportedReasoningEfforts ?? [];
      const effort = supportedEfforts.some(
        (option) => option.reasoningEffort === current.effort,
      )
        ? current.effort
        : defaultEffortForModel(selectedModel);
      return { model, effort };
    });
  }

  function setEffort(effort: string) {
    setSelection((current) => ({ ...current, effort }));
  }

  return {
    effort: selection.effort,
    model: selection.model,
    setEffort,
    setModel,
  };
}
