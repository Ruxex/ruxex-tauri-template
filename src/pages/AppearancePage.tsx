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
        contextDrawerOpen={preferences.contextDrawerOpen}
        density={preferences.density}
        onContextDrawerChange={(contextDrawerOpen) =>
          update({ contextDrawerOpen })
        }
        onDensityChange={(density) => update({ density })}
        onSidebarChange={(sidebarCollapsed) => update({ sidebarCollapsed })}
        onThemeChange={(theme) => update({ theme })}
        sidebarCollapsed={preferences.sidebarCollapsed}
        theme={preferences.theme}
      />
    </div>
  );
}
