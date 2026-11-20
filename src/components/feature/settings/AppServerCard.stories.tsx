import type { Story } from "@ladle/react";
import { AppServerCard } from "./AppServerCard";

export default { title: "Feature / Settings / App Server Card" };

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

export const RunningDaemon: Story = () => (
  <div className="max-w-3xl p-4">
    <AppServerCard
      appServerReady
      appServerVersion="1.0.0"
      connected
      daemon={{
        managedRuxexPath: "/workspace/.ruxex",
        socketPath: "/tmp/ruxex.sock",
        status: "running",
      }}
      isAvailable
      isFetching={false}
      isPending={false}
      isRefreshing={false}
      isUpdatePending={false}
      mode="daemon"
      onAction={() => undefined}
      onReconnect={() => undefined}
      onRefresh={() => undefined}
      onUpdate={() => undefined}
      resynchronizing={false}
    />
  </div>
);
