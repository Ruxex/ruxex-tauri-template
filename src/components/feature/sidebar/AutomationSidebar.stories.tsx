import type { Story } from "@ladle/react";

import { appServerQueryKeys } from "@/app-server/query-keys";
import { CatalogQueryProvider } from "../../../../.ladle/support/catalog-providers";
import { AutomationSidebar } from "./AutomationSidebar";

export const RecentRuns: Story = () => (
  <CatalogQueryProvider
    seeds={[
      {
        queryKey: appServerQueryKeys.schedules,
        data: [
          {
            id: "schedule-catalog",
            name: "Weekly review",
            prompt: "Review the project",
            icon: "calendar",
            color: "blue",
            threadId: "thread-catalog",
            cadence: {
              kind: "weekly",
              weekdays: [1],
              hour: 9,
              minute: 0,
              timeZone: "UTC",
            },
            enabled: true,
            nextRunAt: "2026-11-23T09:00:00Z",
            lastRun: {
              threadId: "thread-catalog",
              at: "2026-11-16T09:00:00Z",
              success: true,
              message: "Completed",
            },
          },
        ],
      },
    ]}
  >
    <div className="h-[32rem] w-80 border border-base-300 bg-base-100">
      <AutomationSidebar onClose={() => undefined} />
    </div>
  </CatalogQueryProvider>
);
