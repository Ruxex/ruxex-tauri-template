import { XMarkIcon } from "@heroicons/react/24/outline";

import { SkillIcon } from "../common/SkillIcon";
import type { SelectedComposerSkill as SelectedSkill } from "./ComposerTextInput";

export function SelectedComposerSkill({
  skill,
  onRemove,
}: {
  skill: SelectedSkill;
  onRemove: () => void;
}) {
  return (
    <span
      aria-label={`Selected skill: ${skill.name}`}
      className="badge badge-primary badge-outline max-w-56 gap-1 py-3"
      role="status"
    >
      <SkillIcon className="size-3.5" skill={skill} />
      <span className="truncate">{skill.name}</span>
      <button
        aria-label={`Remove skill ${skill.name}`}
        className="btn btn-ghost btn-xs btn-circle -mr-1 size-5 min-h-5"
        onClick={onRemove}
        type="button"
      >
        <XMarkIcon aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}
