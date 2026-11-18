import type { Story } from "@ladle/react";

import { CatalogSurface } from "../../../../.ladle/support/catalog-providers";
import type { v2 } from "@/protocol";
import { ChatTable } from "./ChatTable";

const threads = [
  {
    id: "thread-catalog",
    name: "Component catalog",
    preview: "Review the component states",
    updatedAt: 1_700_000_000,
    status: { type: "idle" },
    projectId: "project-ruxex",
  },
] as unknown as v2.Thread[];

export const WithProjectAndArchive: Story = () => (
  <CatalogSurface>
    <ChatTable
      isArchiving={false}
      onArchive={() => undefined}
      projectNames={new Map([["project-ruxex", "Ruxex"]])}
      threads={threads}
    />
  </CatalogSurface>
);

export const Empty: Story = () => (
  <CatalogSurface>
    <ChatTable threads={[]} />
  </CatalogSurface>
);
