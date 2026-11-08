import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "../../app-server/query-keys";
import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { ThreadList } from "./ThreadList";

export const Empty: Story = () => <ThreadList />;

export const ProjectThreads: Story = () => (
  <ThreadList projectId="project-catalog" />
);

const thread = {
  id: "thread-catalog",
  name: "Improve the component catalog",
  preview: "Review states, spacing, and responsive behavior.",
  model: "gpt-5-codex",
  updatedAt: 1_700_000_000,
  status: { type: "idle" },
} as never;

export const Populated: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: appServerQueryKeys.threadList({
          archived: false,
          limit: 50,
          sortKey: "recency_at",
          sortDirection: "desc",
        }),
        data: { data: [thread], nextCursor: null, backwardsCursor: null },
      },
    ]}
  >
    <CatalogSurface>
      <ThreadList selectedThreadId="thread-catalog" />
    </CatalogSurface>
  </CatalogQueryProvider>
);
