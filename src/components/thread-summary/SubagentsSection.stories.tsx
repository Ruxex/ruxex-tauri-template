import type { Story } from "@ladle/react";

import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { appServerQueryKeys } from "../../app-server/query-keys";
import { SubagentsSection } from "./SubagentsSection";

export const Empty: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: appServerQueryKeys.subagentThreadList("thread-catalog"),
        data: { data: [], nextCursor: null, backwardsCursor: null },
      },
    ]}
  >
    <CatalogSurface>
      <SubagentsSection
        onSelect={() => undefined}
        parentThreadId="thread-catalog"
        selectedThreadId={null}
      />
    </CatalogSurface>
  </CatalogQueryProvider>
);
