import { useTranslation } from "react-i18next";
import {
  ArchiveBoxIcon,
  CpuChipIcon,
  InformationCircleIcon,
  PuzzlePieceIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TagIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { NavLink } from "react-router-dom";

import { SidebarHeader } from "./SidebarHeader";

export function SettingsSidebar({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("navigation");
  return (
    <aside
      aria-label={t("navigation:settingsSidebar")}
      className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label={t("navigation:settings")} onClose={onClose} />
      <nav aria-label={t("navigation:settingsSections")} className="space-y-3">
        <section aria-labelledby="settings-personal-heading">
          <h3
            className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-base-content/50"
            id="settings-personal-heading"
          >
            {t("navigation:personal")}
          </h3>
          <ul className="menu w-full gap-1 p-0">
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                end
                to="/settings"
              >
                <InformationCircleIcon aria-hidden="true" className="size-4" />
                {t("navigation:general")}
              </NavLink>
            </li>
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/appearance"
              >
                <SparklesIcon aria-hidden="true" className="size-4" />
                {t("navigation:appearance")}
              </NavLink>
            </li>
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/archive"
              >
                <ArchiveBoxIcon aria-hidden="true" className="size-4" />
                {t("navigation:archivedChats")}
              </NavLink>
            </li>
          </ul>
        </section>
        <hr className="border-base-300" />
        <section aria-labelledby="settings-integrations-heading">
          <h3
            className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-base-content/50"
            id="settings-integrations-heading"
          >
            {t("navigation:integrations")}
          </h3>
          <ul className="menu w-full gap-1 p-0">
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/marketplaces"
              >
                <PuzzlePieceIcon aria-hidden="true" className="size-4" />
                {t("navigation:pluginMarketplaces")}
              </NavLink>
            </li>
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/hooks"
              >
                <ShieldCheckIcon aria-hidden="true" className="size-4" />
                {t("navigation:hooks")}
              </NavLink>
            </li>
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/mcp-servers"
              >
                <WrenchScrewdriverIcon aria-hidden="true" className="size-4" />
                {t("navigation:mcpServers")}
              </NavLink>
            </li>
          </ul>
        </section>
        <hr className="border-base-300" />
        <section aria-labelledby="settings-system-heading">
          <h3
            className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-base-content/50"
            id="settings-system-heading"
          >
            {t("navigation:system")}
          </h3>
          <ul className="menu w-full gap-1 p-0">
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/provider"
              >
                <CpuChipIcon aria-hidden="true" className="size-4" />
                {t("navigation:provider")}
              </NavLink>
            </li>
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/app-server"
              >
                <ServerIcon aria-hidden="true" className="size-4" />
                {t("navigation:appServer")}
              </NavLink>
            </li>
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/version"
              >
                <TagIcon aria-hidden="true" className="size-4" />
                {t("navigation:version")}
              </NavLink>
            </li>
          </ul>
        </section>
      </nav>
    </aside>
  );
}
