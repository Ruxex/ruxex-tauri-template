import {
  useAccount,
  useAppServerEvents,
  useAppServerConnection,
  useAppServerStatus,
  useModelList,
  useModelProvider,
  useModelProviderCapabilities,
  usePermissionProfiles,
} from "../app-server/hooks";
import { isDesktopRuntime } from "../app-server/runtime";
import { useUiPreferences } from "../app/ui-preferences";
import { RemoteConnectionCard } from "../components/connection/RemoteConnectionCard";
import {
  CapabilitiesCard,
  ConnectionCard,
  ProviderAccountCard,
  RuntimeSummary,
  UiPreferencesCard,
} from "../components/settings/SettingsCards";

export function SettingsOverviewPage() {
  const status = useAppServerStatus();
  const connection = useAppServerConnection();
  const events = useAppServerEvents();
  const account = useAccount();
  const provider = useModelProvider();
  const capabilities = useModelProviderCapabilities();
  const models = useModelList();
  const permissions = usePermissionProfiles();
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
        <ProviderAccountCard
          provider={
            provider.data?.name ?? account.data?.providerId ?? "Unavailable"
          }
          authStatus={account.data?.authStatus ?? "Unknown"}
          account={account.data?.displayName ?? "Not signed in"}
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
      <CapabilitiesCard capabilities={capabilities.data ?? {}} />
      <RuntimeSummary
        modelCount={models.data?.data.length ?? 0}
        permissionCount={permissions.data?.data.length ?? 0}
        rateLimitName={account.data?.usage?.limitName ?? "Unavailable"}
      />
      <UiPreferencesCard
        contextDrawerOpen={preferences.contextDrawerOpen}
        density={preferences.density}
        onContextDrawerChange={(contextDrawerOpen) =>
          update({ contextDrawerOpen })
        }
        onDensityChange={(density) => update({ density })}
        onSidebarChange={(sidebarCollapsed) => update({ sidebarCollapsed })}
        onThemeChange={(theme) => update({ theme })}
        sidebarCollapsed={preferences.sidebarCollapsed}
        theme={preferences.theme}
      />
    </div>
  );
}
