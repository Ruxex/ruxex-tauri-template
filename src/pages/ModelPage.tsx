import { useTranslation } from "react-i18next";
import {
  useAccount,
  useAppServerStatus,
  useModelList,
  useModelProvider,
  useModelProviderCapabilities,
  usePermissionProfiles,
} from "@/app-server/hooks";
import { CapabilitiesCard, ProviderAccountCard, RuntimeSummary } from "@/components/feature/settings/SettingsCards";

export function ModelPage() {
  const { t } = useTranslation("capabilities");
  const account = useAccount();
  const appServerStatus = useAppServerStatus();
  const capabilities = useModelProviderCapabilities();
  const models = useModelList();
  const provider = useModelProvider();
  const permissions = usePermissionProfiles();

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold tracking-tight">{t("provider")}</h2>
      <ProviderAccountCard
        provider={provider.data?.name ?? account.data?.providerId ?? t("unavailable")}
        authStatus={account.data?.authStatus ?? t("unknown")}
        account={account.data?.displayName ?? t("notSignedIn")}
        dataDirectory={appServerStatus.data?.homeDataDir ?? t("unavailable")}
      />
      <CapabilitiesCard capabilities={capabilities.data ?? {}} />
      <RuntimeSummary
        modelCount={models.data?.data.length ?? 0}
        models={models.data?.data}
        permissionCount={permissions.data?.data.length ?? 0}
        rateLimitName={account.data?.usage?.limitName ?? t("unavailable")}
      />
    </div>
  );
}
