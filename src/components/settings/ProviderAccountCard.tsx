import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

import { StateBadge } from "../common/StateBadge";
import { SettingRow, SettingsPanel } from "./SettingsPanel";

type ProviderAccountCardProps = {
  provider: string;
  authStatus: string;
  account: string;
  dataDirectory: string;
};

export function ProviderAccountCard({
  provider,
  authStatus,
  account,
  dataDirectory,
}: ProviderAccountCardProps) {
  return (
    <SettingsPanel icon={UserCircleIcon} title="Provider and account">
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Provider">{provider}</SettingRow>
        <SettingRow label="Auth">
          <StateBadge
            icon={
              authStatus === "authenticated"
                ? CheckCircleIcon
                : ExclamationTriangleIcon
            }
            tone={authStatus === "authenticated" ? "success" : "warning"}
          >
            {authStatus}
          </StateBadge>
        </SettingRow>
        <SettingRow label="Account">{account}</SettingRow>
        <SettingRow label="Data directory">
          <span
            className="block truncate font-mono text-xs"
            title={dataDirectory}
          >
            {dataDirectory}
          </span>
        </SettingRow>
      </dl>
    </SettingsPanel>
  );
}
