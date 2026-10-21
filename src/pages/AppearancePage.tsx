import { useUiPreferences } from "../app/ui-preferences";
import { UiPreferencesCard } from "../components/settings/SettingsCards";

export function AppearancePage() {
  const { preferences, update } = useUiPreferences();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Settings
        </p>
        <h2 className="text-2xl font-semibold">Appearance</h2>
      </div>
      <UiPreferencesCard
        density={preferences.density}
        onDensityChange={(density) => update({ density })}
        onThemeChange={(theme) => update({ theme })}
        theme={preferences.theme}
      />
    </div>
  );
}
