import { useTranslation } from "react-i18next";
import { SparklesIcon } from "@heroicons/react/24/outline";

import type { v2 } from "@/protocol";
import { MarketplaceAssetImage } from "@/components/composite/plugins/MarketplaceAssetImage";

type SkillIconSkill = {
  name: string;
  interface?: v2.SkillInterface | null;
};

type SkillIconProps = {
  skill: SkillIconSkill;
  className?: string;
};

export function SkillIcon({ skill, className = "size-5" }: SkillIconProps) {
  const { t } = useTranslation("common");
  const interfaceData = skill.interface;
  const localSource = interfaceData?.iconSmall ?? interfaceData?.iconLarge ?? null;
  const remoteSource = interfaceData?.iconSmallUrl ?? interfaceData?.iconLargeUrl ?? null;

  if (!localSource && !remoteSource) {
    return <SparklesIcon aria-hidden="true" className={className} data-testid="skill-icon-fallback" />;
  }

  const displayName = interfaceData?.displayName ?? skill.name;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      data-testid="skill-icon-frame"
    >
      <MarketplaceAssetImage
        alt={t("common:skillIcon", { name: displayName })}
        className="size-full object-contain"
        localSrc={localSource}
        src={remoteSource}
      />
    </span>
  );
}
