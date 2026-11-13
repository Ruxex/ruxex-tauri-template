import {
  ArchiveBoxIcon,
  DocumentTextIcon,
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
  return (
    <aside
      aria-label="Settings sidebar"
      className="h-full min-h-0 w-72 overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label="Settings" onClose={onClose} />
      <nav aria-label="Settings sections" className="space-y-3">
        <section aria-labelledby="settings-personal-heading">
          <h3
            className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-base-content/50"
            id="settings-personal-heading"
          >
            Personal
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
                General
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
                Appearance
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
                Archived chats
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
            Integrations
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
                Plugin marketplaces
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
                Hooks
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
                <WrenchScrewdriverIcon
                  aria-hidden="true"
                  className="size-4"
                />
                MCP servers
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
            System
          </h3>
          <ul className="menu w-full gap-1 p-0">
            <li>
              <NavLink
                className={({ isActive }) =>
                  isActive
                    ? "bg-primary/15 font-medium text-base-content hover:bg-primary/20"
                    : undefined
                }
                to="/settings/models"
              >
                <DocumentTextIcon aria-hidden="true" className="size-4" />
                Models / Engines
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
                App Server
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
                Version
              </NavLink>
            </li>
          </ul>
        </section>
      </nav>
    </aside>
  );
}
