import type { ComponentType, SVGProps } from "react";
import {
  CalendarDaysIcon,
  Cog6ToothIcon,
  FolderIcon,
  HomeIcon,
  PuzzlePieceIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

export type SidebarPanel =
  | "home"
  | "projects"
  | "plugins"
  | "automation"
  | "account"
  | "settings";

export type SidebarIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type SidebarPanelDefinition = {
  id: SidebarPanel;
  label: string;
  icon: SidebarIcon;
  route: string;
};

export const SIDEBAR_PANELS: readonly SidebarPanelDefinition[] = [
  { id: "home", label: "Home", icon: HomeIcon, route: "/" },
  { id: "projects", label: "Projects", icon: FolderIcon, route: "/projects" },
  {
    id: "plugins",
    label: "Plugins",
    icon: PuzzlePieceIcon,
    route: "/capabilities",
  },
  {
    id: "automation",
    label: "Automation",
    icon: CalendarDaysIcon,
    route: "/schedules",
  },
  {
    id: "account",
    label: "Account",
    icon: UserCircleIcon,
    route: "/settings/account",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Cog6ToothIcon,
    route: "/settings",
  },
];

export function sidebarPanelForPath(pathname: string): SidebarPanel {
  if (pathname.startsWith("/settings/account")) return "account";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/capabilities")) return "plugins";
  if (pathname.startsWith("/schedules")) return "automation";
  return "home";
}
