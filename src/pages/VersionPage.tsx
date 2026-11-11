import packageJson from "../../package.json";

import { useAppServerDaemon, useAppServerStatus } from "../app-server/hooks";
import {
  SettingRow,
  SettingsPanel,
} from "../components/settings/SettingsCards";

function displayVersion(version: string | null | undefined): string {
  return version || "Unavailable";
}

export function VersionPage() {
  const appServerStatus = useAppServerStatus();
  const daemon = useAppServerDaemon();
  const daemonVersion = daemon.status.data;

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold tracking-tight">Version</h2>
      <SettingsPanel title="Installed versions">
        <dl>
          <SettingRow label="Ruxex Desktop">
            {displayVersion(packageJson.version)}
          </SettingRow>
          <SettingRow label="App Server">
            {displayVersion(appServerStatus.data?.appServerVersion)}
          </SettingRow>
          <SettingRow label="Managed Ruxex">
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
