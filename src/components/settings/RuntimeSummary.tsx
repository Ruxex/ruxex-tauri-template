import { CpuChipIcon } from "@heroicons/react/24/outline";

import { SettingRow, SettingsPanel } from "./SettingsPanel";

type RuntimeSummaryProps = {
  modelCount: number;
  permissionCount: number;
  rateLimitName: string;
};

export function RuntimeSummary({
  modelCount,
  permissionCount,
  rateLimitName,
}: RuntimeSummaryProps) {
  return (
    <SettingsPanel icon={CpuChipIcon} title="Runtime summary">
      <dl className="divide-y divide-base-300 text-sm">
        <SettingRow label="Models">{modelCount} available</SettingRow>
        <SettingRow label="Permissions">
          {permissionCount} profiles
        </SettingRow>
        <SettingRow label="Rate limits">{rateLimitName}</SettingRow>
      </dl>
    </SettingsPanel>
  );
}
