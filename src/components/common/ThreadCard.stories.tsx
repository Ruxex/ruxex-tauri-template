import type { Story } from "@ladle/react";

import { catalogThread } from "../../../.ladle/support/catalog-data";
import { ThreadCard } from "./ThreadCard";

export const Default: Story = () => (
  <ThreadCard
    actions={
      <button aria-label="Open" className="btn btn-ghost btn-sm" type="button">
        Open
      </button>
    }
    thread={{
      ...catalogThread,
      preview: catalogThread.preview,
      status: { type: "idle" },
    }}
  />
);

export const Compact: Story = () => (
  <div className="w-96">
    <ThreadCard
      compact
      thread={{
        ...catalogThread,
        preview: catalogThread.preview,
        status: { type: "idle" },
      }}
    />
  </div>
);
