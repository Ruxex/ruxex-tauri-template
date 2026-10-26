import {
  DocumentTextIcon,
  InformationCircleIcon,
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
      <nav aria-label="Settings sections" className="menu w-full gap-1 p-0">
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
          <NavLink to="/settings/models">
            <DocumentTextIcon aria-hidden="true" className="size-4" />
            Models
          </NavLink>
        </li>
        <li>
          <NavLink to="/settings/app-server">
            <ServerIcon aria-hidden="true" className="size-4" />
            AppServer
          </NavLink>
        </li>
      </nav>
    </aside>
  );
}
