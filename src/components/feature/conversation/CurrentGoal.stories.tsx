import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "@/app-server/query-keys";
import { CatalogQueryProvider, CatalogSurface } from "../../../../.ladle/support/catalog-providers";
import { CurrentGoal } from "./CurrentGoal";

export default { title: "Feature / Conversation / Current Goal" };

export const Active: Story = () => (
  <CatalogQueryProvider
    seeds={[
      {
        queryKey: appServerQueryKeys.threadGoal("thread-catalog"),
        data: {
          goal: {
            status: "active",
            objective: "Complete the catalog coverage.",
          },
        },
      },
    ]}
  >
    <CatalogSurface>
      <CurrentGoal threadId="thread-catalog" />
    </CatalogSurface>
  </CatalogQueryProvider>
);
