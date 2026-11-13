import {
  useAccount,
  useAppServerStatus,
  useModelList,
  useModelProvider,
  useModelProviderCapabilities,
  usePermissionProfiles,
} from "../app-server/hooks";
import {
  CapabilitiesCard,
  ProviderAccountCard,
  RuntimeSummary,
} from "../components/settings/SettingsCards";

export function ModelPage() {
  const account = useAccount();
  const appServerStatus = useAppServerStatus();
  const capabilities = useModelProviderCapabilities();
  const models = useModelList();
  const provider = useModelProvider();
  const permissions = usePermissionProfiles();

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold tracking-tight">Provider</h2>
      <ProviderAccountCard
        provider={
          provider.data?.name ?? account.data?.providerId ?? "Unavailable"
        }
        authStatus={account.data?.authStatus ?? "Unknown"}
        account={account.data?.displayName ?? "Not signed in"}
        dataDirectory={appServerStatus.data?.homeDataDir ?? "Unavailable"}
      />
      <CapabilitiesCard capabilities={capabilities.data ?? {}} />
      <RuntimeSummary
        modelCount={models.data?.data.length ?? 0}
        models={models.data?.data}
        permissionCount={permissions.data?.data.length ?? 0}
        rateLimitName={account.data?.usage?.limitName ?? "Unavailable"}
      />
    </div>
  );
}
