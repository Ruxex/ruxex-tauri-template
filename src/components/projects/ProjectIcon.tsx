import {
  BookOpenIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CloudIcon,
  CodeBracketIcon,
  CubeIcon,
  DocumentTextIcon,
  FolderIcon,
  GlobeAltIcon,
  HeartIcon,
  HomeIcon,
  RocketLaunchIcon,
  StarIcon,
  WrenchScrewdriverIcon,
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
  briefcase: BriefcaseIcon,
  calendar: CalendarDaysIcon,
  chart: ChartBarIcon,
  chat: ChatBubbleLeftRightIcon,
  cloud: CloudIcon,
  document: DocumentTextIcon,
  heart: HeartIcon,
  home: HomeIcon,
  rocket: RocketLaunchIcon,
  star: StarIcon,
  wrench: WrenchScrewdriverIcon,
};

export function ProjectIcon({ icon, ...props }: ProjectIconProps) {
  const Icon = PROJECT_ICONS[icon] ?? FolderIcon;
  return <Icon {...props} />;
}
