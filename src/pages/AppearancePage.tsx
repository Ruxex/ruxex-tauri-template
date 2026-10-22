import { useUiPreferences } from "../app/ui-preferences";
import { UiPreferencesCard } from "../components/settings/SettingsCards";

export function AppearancePage() {
  const { preferences, update } = useUiPreferences();

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Appearance</h2>
      <UiPreferencesCard
        colorScheme={preferences.colorScheme}
        density={preferences.density}
        onAccentColorChange={(accentColor) =>
          update({ theme: { ...preferences.theme, accentColor } })
        }
        onColorSchemeChange={(colorScheme) => update({ colorScheme })}
        onDensityChange={(density) => update({ density })}
        theme={preferences.theme}
      />
    </div>
  );
}
