import type { Story } from "@ladle/react";
import { AppServerCard } from "./AppServerCard";

export const ConnectedInProcess: Story = () => (
  <div className="max-w-3xl p-4">
    <AppServerCard
      appServerReady
      appServerVersion="1.0.0"
      connected
      isAvailable={false}
      isFetching={false}
      isPending={false}
      isRefreshing={false}
      isUpdatePending={false}
      mode="inprocess"
      onAction={() => undefined}
      onReconnect={() => undefined}
      onRefresh={() => undefined}
      onUpdate={() => undefined}
      resynchronizing={false}
    />
  </div>
);
