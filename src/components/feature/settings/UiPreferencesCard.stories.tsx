import type { Story } from "@ladle/react";
import { UiPreferencesCard } from "./UiPreferencesCard";

export const SystemTheme: Story = () => (
  <div className="max-w-3xl p-4">
    <UiPreferencesCard preset="system" onThemePresetChange={() => undefined} />
  </div>
);
