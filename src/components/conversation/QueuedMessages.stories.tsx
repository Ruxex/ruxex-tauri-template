import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "../../app-server/query-keys";
import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { QueuedMessages } from "./QueuedMessages";

export const Empty: Story = () => (
  <CatalogSurface>
    <QueuedMessages threadId="thread-catalog" />
  </CatalogSurface>
);

export const WithMessages: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: appServerQueryKeys.threadQueue("thread-catalog", {}),
        data: {
          data: [
            {
              id: "queued-1",
              input: [
                {
                  type: "text",
                  text: "Please also check the mobile layout.",
                  text_elements: [],
                },
              ],
              clientUserMessageId: "client-queued-1",
            },
            {
              id: "queued-2",
              input: [{ type: "image", url: "https://example.com/catalog.png" }],
              clientUserMessageId: "client-queued-2",
            },
          ],
          nextCursor: null,
        },
      },
    ]}
  >
    <CatalogSurface>
      <QueuedMessages threadId="thread-catalog" />
    </CatalogSurface>
  </CatalogQueryProvider>
);
