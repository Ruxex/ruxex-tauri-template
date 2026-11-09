import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "../../app-server/query-keys";
import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { LadleDialogTrigger } from "../../../.ladle/support/LadleDialogTrigger";
import { ChatSearchDialog } from "./ChatSearchDialog";

export const Open: Story = () => (
  <LadleDialogTrigger
    label="Open chat search"
    renderDialog={(onClose) => (
      <CatalogSurface>
        <ChatSearchDialog onClose={onClose} onSelect={() => undefined} />
      </CatalogSurface>
    )}
  />
);

const searchParams = {
  searchTerm: "compiler",
  limit: 50,
  sortKey: "recency_at" as const,
  sortDirection: "desc" as const,
};

const matchingThread = {
  id: "thread-search",
  name: "Fix the compiler error",
  preview: "Investigate the compiler output and update the parser.",
  updatedAt: 1_700_000_000,
} as never;

export const Results: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: appServerQueryKeys.threadSearch(searchParams),
        data: {
          data: [
            { thread: matchingThread, snippet: "compiler output and parser" },
          ],
          nextCursor: null,
          backwardsCursor: null,
        },
      },
    ]}
  >
    <LadleDialogTrigger
      label="Open search results"
      renderDialog={(onClose) => (
        <CatalogSurface>
          <ChatSearchDialog
            initialSearchTerm="compiler"
            onClose={onClose}
            onSelect={() => undefined}
          />
        </CatalogSurface>
      )}
    />
  </CatalogQueryProvider>
);

export const NoResults: Story = () => {
  const params = { ...searchParams, searchTerm: "nothing-matches" };
  return (
    <CatalogQueryProvider
      seeds={[
        { queryKey: appServerQueryKeys.status, data: { ready: true } },
        {
          queryKey: appServerQueryKeys.threadSearch(params),
          data: { data: [], nextCursor: null, backwardsCursor: null },
        },
      ]}
    >
      <LadleDialogTrigger
        label="Open no-results search"
        renderDialog={(onClose) => (
          <CatalogSurface>
            <ChatSearchDialog
              initialSearchTerm="nothing-matches"
              onClose={onClose}
              onSelect={() => undefined}
            />
          </CatalogSurface>
        )}
      />
    </CatalogQueryProvider>
  );
};
