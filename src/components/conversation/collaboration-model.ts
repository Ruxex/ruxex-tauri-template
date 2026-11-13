import type { v2 } from "../../protocol";
import type { CollaborationMode } from "../../protocol/generated/CollaborationMode";

export function collaborationModeFromMask(
  mask: v2.CollaborationModeMask,
  fallbackModel?: string,
  fallbackEffort?: string,
): CollaborationMode | null {
  const model = mask.model ?? fallbackModel;
  if (!mask.mode || !model) {
    return null;
  }
  return {
    mode: mask.mode,
    settings: {
      model,
      reasoning_effort: mask.reasoning_effort ?? fallbackEffort ?? null,
      developer_instructions: null,
    },
  };
}

export function planCollaborationMode(
  presets: v2.CollaborationModeMask[],
  model: string,
  effort: string,
): CollaborationMode | null {
  if (!model) {
    return null;
  }

  const planPreset = presets.find((preset) => preset.mode === "plan");
  if (planPreset) {
    const mode = collaborationModeFromMask(planPreset, model, effort);
    if (mode) {
      return mode;
    }
  }

  return {
    mode: "plan",
    settings: {
      model,
      reasoning_effort: effort || null,
      developer_instructions: null,
    },
  };
}
