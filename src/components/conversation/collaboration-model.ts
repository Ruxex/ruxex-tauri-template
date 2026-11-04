import type { v2 } from "../../protocol";
import type { CollaborationMode } from "../../protocol/generated/CollaborationMode";

export function collaborationModeFromMask(
  mask: v2.CollaborationModeMask,
): CollaborationMode | null {
  if (!mask.mode || !mask.model) {
    return null;
  }
  return {
    mode: mask.mode,
    settings: {
      model: mask.model,
      reasoning_effort: mask.reasoning_effort,
      developer_instructions: null,
    },
  };
}
