import type { Story } from "@ladle/react";

import { CatalogRouter } from "../../../.ladle/support/catalog-providers";
import { BrowserNavigationBar } from "./BrowserNavigationBar";

export const SettingsBreadcrumbs: Story = () => (
  <CatalogRouter initialEntries={["/settings/appearance"]}>
    <BrowserNavigationBar />
  </CatalogRouter>
);

export const ProjectBreadcrumbs: Story = () => (
  <CatalogRouter initialEntries={["/projects/project-catalog"]}>
    <BrowserNavigationBar projectTitle="Ruxex" />
  </CatalogRouter>
);
