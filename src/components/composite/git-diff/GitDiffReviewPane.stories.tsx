import type { Story } from "@ladle/react";

import { CatalogQueryProvider } from "../../../../.ladle/support/catalog-providers";
import { gitDiffDetailsQueryKey } from "@/platform/git-diff";
import { GitDiffReviewPane } from "./GitDiffReviewPane";

export const ChangedFiles: Story = () => (
  <CatalogQueryProvider
    seeds={[
      {
        queryKey: gitDiffDetailsQueryKey("/workspace/ruxex"),
        data: [
          {
            path: "src/app.ts",
            status: "modified",
            added: 12,
            deleted: 3,
            binary: true,
            patch: null,
          },
          {
            path: "docs/overview.md",
            status: "added",
            added: 28,
            deleted: 0,
            binary: true,
            patch: null,
          },
        ],
      },
    ]}
  >
    <div className="h-[36rem] max-w-4xl border border-base-300 bg-base-100">
      <GitDiffReviewPane target={{ threadId: "thread-catalog", workspace: "/workspace/ruxex" }} isOpen />
    </div>
  </CatalogQueryProvider>
);
