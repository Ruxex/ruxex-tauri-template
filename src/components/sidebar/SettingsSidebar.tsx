import {
  DocumentTextIcon,
  InformationCircleIcon,
  PuzzlePieceIcon,
  ServerIcon,
  SparklesIcon,
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
              <NavLink end to="/settings">
                <InformationCircleIcon aria-hidden="true" className="size-4" />
                General
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings/appearance">
                <SparklesIcon aria-hidden="true" className="size-4" />
                Appearance
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings/marketplaces">
                <PuzzlePieceIcon aria-hidden="true" className="size-4" />
                Plugin marketplaces
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
              <NavLink to="/settings/models">
                <DocumentTextIcon aria-hidden="true" className="size-4" />
                Models / Engines
              </NavLink>
            </li>
            <li>
              <NavLink to="/settings/app-server">
                <ServerIcon aria-hidden="true" className="size-4" />
                Runtime
              </NavLink>
            </li>
          </ul>
        </section>
      </nav>
    </aside>
  );
}
