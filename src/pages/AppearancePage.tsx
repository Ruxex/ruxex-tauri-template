import { useUiPreferences } from "../app/ui-preferences";
import { UiPreferencesCard } from "../components/settings/SettingsCards";

export function AppearancePage() {
  const { preferences, update } = useUiPreferences();

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Appearance</h2>
      <UiPreferencesCard
        chatFontSize={preferences.chatFontSize}
        colorScheme={preferences.colorScheme}
        onAccentColorChange={(accentColor) =>
          update({ theme: { ...preferences.theme, accentColor } })
        }
        onChatFontSizeChange={(chatFontSize) => update({ chatFontSize })}
        onColorSchemeChange={(colorScheme) => update({ colorScheme })}
        onUiFontSizeChange={(uiFontSize) => update({ uiFontSize })}
        theme={preferences.theme}
        uiFontSize={preferences.uiFontSize}
      />
    </div>
  );
}
