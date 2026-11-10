import { SparklesIcon } from "@heroicons/react/24/outline";

import type { v2 } from "../../protocol";
import { MarketplaceAssetImage } from "../plugins/MarketplaceAssetImage";

type SkillIconSkill = {
  name: string;
  interface?: v2.SkillInterface | null;
};

type SkillIconProps = {
  skill: SkillIconSkill;
  className?: string;
};

export function SkillIcon({ skill, className = "size-5" }: SkillIconProps) {
  const interfaceData = skill.interface;
  const localSource =
    interfaceData?.iconSmall ?? interfaceData?.iconLarge ?? null;
  const remoteSource =
    interfaceData?.iconSmallUrl ?? interfaceData?.iconLargeUrl ?? null;

  if (!localSource && !remoteSource) {
    return (
      <SparklesIcon
        aria-hidden="true"
        className={className}
        data-testid="skill-icon-fallback"
      />
    );
  }

  const displayName = interfaceData?.displayName ?? skill.name;
  return (
    <MarketplaceAssetImage
      alt={`${displayName} icon`}
      className={className}
      localSrc={localSource}
      src={remoteSource}
    />
  );
}
