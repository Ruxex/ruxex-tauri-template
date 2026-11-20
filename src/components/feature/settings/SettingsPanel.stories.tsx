import type { Story } from "@ladle/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { SettingRow, SettingsPanel } from "./SettingsPanel";

export default { title: "Feature / Settings / Settings Panel" };

export const WithRows: Story = () => (
  <div className="max-w-3xl p-4">
    <SettingsPanel icon={InformationCircleIcon} title="Runtime details">
      <SettingRow label="Connection">
        <span className="text-success">Connected</span>
      </SettingRow>
      <SettingRow label="Version">1.0.0</SettingRow>
    </SettingsPanel>
  </div>
);
