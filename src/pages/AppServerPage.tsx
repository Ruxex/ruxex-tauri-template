import {
  useAppServerDaemon,
  useAppServerEvents,
  useAppServerStatus,
  useConfig,
  useConfigRequirements,
} from "../app-server/hooks";
import { BrowserComputerUseCard } from "../components/capabilities/BrowserComputerUseCard";
import { AppServerCard } from "../components/settings/SettingsCards";

export function AppServerPage() {
  const daemon = useAppServerDaemon();
  const status = useAppServerStatus();
  const events = useAppServerEvents();
  const config = useConfig();
  const configRequirements = useConfigRequirements();

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold tracking-tight">Runtime</h2>
      <AppServerCard
        appServerVersion={status.data?.appServerVersion}
        appServerError={daemon.appServerError}
        appServerReady={daemon.appServerReady}
        connected={events.connected}
        connectionError={status.isError ? status.error : undefined}
        controlError={daemon.control.error}
        daemon={daemon.status.data}
        daemonError={daemon.status.error}
        isAvailable={daemon.isAvailable}
        isFetching={status.isFetching}
        mode={daemon.mode}
        isPending={daemon.control.isPending}
        isUpdatePending={daemon.update.isPending}
        onAction={(action) => daemon.control.mutate(action)}
        onReconnect={() => void status.refetch()}
        onUpdate={() => daemon.update.mutate()}
        resynchronizing={events.resynchronizing}
        updateError={daemon.update.error}
      />
      <BrowserComputerUseCard
        config={config.data?.config ?? null}
        requirements={configRequirements.data?.requirements ?? null}
      />
    </div>
  );
}
