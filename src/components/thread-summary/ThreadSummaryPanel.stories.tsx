import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "../../app-server/query-keys";
import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { ThreadSummaryPanel } from "./ThreadSummaryPanel";

const childThreads = [
  {
    id: "child-api",
    preview: "Inspect the API client",
    updatedAt: 200,
    agentNickname: "API scout",
    agentRole: "researcher",
    status: { type: "active", activeFlags: [] },
  },
  {
    id: "child-tests",
    preview: "Run the test suite",
    updatedAt: 300,
    agentNickname: "Test runner",
    agentRole: null,
    status: { type: "idle" },
  },
] as never;

export const Loaded: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: appServerQueryKeys.subagentThreadList("thread-catalog"),
        data: { data: childThreads, nextCursor: null, backwardsCursor: null },
      },
    ]}
  >
    <CatalogSurface>
      <ThreadSummaryPanel
        onClose={() => undefined}
        open
        threadId="thread-catalog"
      />
    </CatalogSurface>
  </CatalogQueryProvider>
);

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
      <ThreadSummaryPanel
        onClose={() => undefined}
        open
        threadId="thread-catalog"
      />
    </CatalogSurface>
  </CatalogQueryProvider>
);
