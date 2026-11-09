import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "../../app-server/query-keys";
import {
  CatalogQueryProvider,
  CatalogSurface,
} from "../../../.ladle/support/catalog-providers";
import { Composer } from "./Composer";

export const Empty: Story = () => (
  <CatalogSurface>
    <Composer activeTurnId={null} threadId="thread-catalog" />
  </CatalogSurface>
);

export const WithInitialMessage: Story = () => (
  <CatalogSurface>
    <Composer
      activeTurnId={null}
      initialMessage="Please review the current component catalog."
      threadId="thread-catalog"
    />
  </CatalogSurface>
);

export const WithSkillPalette: Story = () => (
  <CatalogQueryProvider
    seeds={[
      { queryKey: appServerQueryKeys.status, data: { ready: true } },
      {
        queryKey: [...appServerQueryKeys.skills, {}],
        data: {
          data: [
            {
              cwd: "/workspace",
              skills: [
                {
                  name: "review",
                  description: "Review the current changes for regressions.",
                  path: "/workspace/.agents/skills/review",
                  scope: "repo",
                  enabled: true,
                  pluginId: null,
                },
              ],
              errors: [],
            },
          ],
        },
      },
    ]}
  >
    <CatalogSurface>
      <Composer
        activeTurnId={null}
        initialMessage="/review Check the current changes"
        threadId="thread-catalog"
      />
    </CatalogSurface>
  </CatalogQueryProvider>
);
