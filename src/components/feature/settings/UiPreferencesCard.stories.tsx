import type { Story } from "@ladle/react";
import { UiPreferencesCard } from "./UiPreferencesCard";

export default { title: "Feature / Settings / UI Preferences Card" };

export const SystemTheme: Story = () => (
  <div className="max-w-3xl p-4">
    <UiPreferencesCard preset="system" onThemePresetChange={() => undefined} />
  </div>
);
