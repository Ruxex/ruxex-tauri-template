import {
  useAppServerEvents,
  useAppServerConnection,
  useAppServerStatus,
} from "../app-server/hooks";
import { isDesktopRuntime } from "../app-server/runtime";
import { useUiPreferences } from "../app/ui-preferences";
import { RemoteConnectionCard } from "../components/connection/RemoteConnectionCard";
import {
  ConnectionCard,
  LanguageCard,
  NotificationsCard,
} from "../components/settings/SettingsCards";

export function SettingsOverviewPage() {
  const status = useAppServerStatus();
  const connection = useAppServerConnection();
  const events = useAppServerEvents();
  const { preferences, update } = useUiPreferences();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Runtime
        </p>
        <h2 className="text-2xl font-semibold">General</h2>
      </div>
      <section className="grid gap-4">
        <ConnectionCard
          connected={events.connected}
          appServerVersion={status.data?.appServerVersion}
          resynchronizing={events.resynchronizing}
          error={status.isError ? status.error : undefined}
          isFetching={status.isFetching}
          onReconnect={() => void status.refetch()}
        />
      </section>
      {isDesktopRuntime && (
        <RemoteConnectionCard
          endpointKind={connection.status.data?.endpointKind}
          error={
            connection.connect.isError
              ? connection.connect.error
              : connection.disconnect.isError
                ? connection.disconnect.error
                : undefined
          }
          isConnecting={connection.connect.isPending}
          isDisconnecting={connection.disconnect.isPending}
          onConnect={(endpoint) => void connection.connect.mutate(endpoint)}
          onDisconnect={() => void connection.disconnect.mutate()}
        />
      )}
      <LanguageCard
        language={preferences.language}
        onLanguageChange={(language) => update({ language })}
      />
      <NotificationsCard
        enabled={preferences.notifications.desktop}
        onEnabledChange={(desktop) =>
          update({ notifications: { ...preferences.notifications, desktop } })
        }
      />
    </div>
  );
}
