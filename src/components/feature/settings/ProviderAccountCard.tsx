import { useTranslation } from "react-i18next";
import { CheckCircleIcon, ExclamationTriangleIcon, UserCircleIcon } from "@heroicons/react/24/outline";

import { StateBadge } from "@/components/base/common/StateBadge";
import { SettingRow, SettingsPanel } from "./SettingsPanel";

type ProviderAccountCardProps = {
  provider: string;
  authStatus: string;
  account: string;
  dataDirectory: string;
};

export function ProviderAccountCard({ provider, authStatus, account, dataDirectory }: ProviderAccountCardProps) {
  const { t } = useTranslation("settings");
  return (
    <SettingsPanel icon={UserCircleIcon} title={t("settings:providerAndAccount")}>
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label={t("settings:provider")}>{provider}</SettingRow>
        <SettingRow label={t("settings:auth")}>
          <StateBadge
            icon={authStatus === "authenticated" ? CheckCircleIcon : ExclamationTriangleIcon}
            tone={authStatus === "authenticated" ? "success" : "warning"}
          >
            {authStatus}
          </StateBadge>
        </SettingRow>
        <SettingRow label={t("settings:account")}>{account}</SettingRow>
        <SettingRow label={t("settings:dataDirectory")}>
          <span className="block truncate font-mono text-xs" title={dataDirectory}>
            {dataDirectory}
          </span>
        </SettingRow>
      </dl>
    </SettingsPanel>
  );
}
