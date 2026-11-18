import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { PageContainer } from "@/components/feature/layout/PageContainer";
import { PluginMarketplacePanel } from "@/pages/capabilities/PluginMarketplacePanel";
import { SkillsCapabilitiesPanel } from "@/pages/capabilities/SkillsCapabilitiesPanel";

type CapabilityTab = "plugins" | "skills";

export function CapabilitiesPage() {
  const { t } = useTranslation("capabilities");
  const location = useLocation();
  const activeTab: CapabilityTab = location.pathname === "/capabilities/skills" ? "skills" : "plugins";

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{activeTab === "plugins" ? t("plugins") : t("skills")}</h1>
        </div>
      </div>
      <SkillsCapabilitiesPanel active={activeTab === "skills"} />
      <PluginMarketplacePanel active={activeTab === "plugins"} />
    </PageContainer>
  );
}
