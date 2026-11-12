import type { Story } from "@ladle/react";

import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { appServerQueryKeys } from "../../app-server/query-keys";
import { ActivityCenter } from "./ActivityCenter";

export const Empty: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: appServerQueryKeys.threadList({
          archived: false,
          limit: 100,
          sortKey: "updated_at",
          sortDirection: "desc",
        }),
        data: { data: [], nextCursor: null, backwardsCursor: null },
      },
    ]}
  >
    <CatalogSurface>
      <ActivityCenter />
    </CatalogSurface>
  </CatalogQueryProvider>
);
