import {
  BookOpenIcon,
  CodeBracketIcon,
  CubeIcon,
  FolderIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";

import type { ProjectIcon as ProjectIconName } from "./project-metadata";

type ProjectIconProps = SVGProps<SVGSVGElement> & {
  icon: ProjectIconName;
};

const PROJECT_ICONS: Record<
  ProjectIconName,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  folder: FolderIcon,
  code: CodeBracketIcon,
  globe: GlobeAltIcon,
  book: BookOpenIcon,
  cube: CubeIcon,
};

export function ProjectIcon({ icon, ...props }: ProjectIconProps) {
  const Icon = PROJECT_ICONS[icon] ?? FolderIcon;
  return <Icon {...props} />;
}
