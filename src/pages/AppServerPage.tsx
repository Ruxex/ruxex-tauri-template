import { useAppServerDaemon } from "../app-server/hooks";
import { AppServerCard } from "../components/settings/SettingsCards";

export function AppServerPage() {
  const daemon = useAppServerDaemon();

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">AppServer</h2>
      <AppServerCard
        appServerError={daemon.appServerError}
        appServerReady={daemon.appServerReady}
        controlError={daemon.control.error}
        daemon={daemon.status.data}
        daemonError={daemon.status.error}
        isAvailable={daemon.isAvailable}
        mode={daemon.mode}
        isPending={daemon.control.isPending}
        onAction={(action) => daemon.control.mutate(action)}
      />
    </div>
  );
}
