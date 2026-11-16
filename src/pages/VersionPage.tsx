import { i18n } from "../app/i18n";
import { useTranslation } from "react-i18next";
import packageJson from "../../package.json";

import { useAppServerDaemon, useAppServerStatus } from "../app-server/hooks";
import {
  SettingRow,
  SettingsPanel,
} from "../components/settings/SettingsCards";

function displayVersion(version: string | null | undefined): string {
  return version || i18n.t("settings:unavailable");
}

export function VersionPage() {
  const { t } = useTranslation("settings");
  const appServerStatus = useAppServerStatus();
  const daemon = useAppServerDaemon();
  const daemonVersion = daemon.status.data;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-semibold tracking-tight">
        {t("settings:version")}
      </h2>
      <SettingsPanel title={t("settings:installedVersions")}>
        <dl>
          <SettingRow label="Ruxex Desktop">
            {displayVersion(packageJson.version)}
          </SettingRow>
          <SettingRow label={t("settings:appServer")}>
            {displayVersion(appServerStatus.data?.appServerVersion)}
          </SettingRow>
          <SettingRow label={t("settings:managedRuxex")}>
            {displayVersion(daemonVersion?.managedRuxexVersion)}
          </SettingRow>
          <SettingRow label="CLI">
            {displayVersion(daemonVersion?.cliVersion)}
          </SettingRow>
        </dl>
      </SettingsPanel>
    </div>
  );
}
