import { useUiPreferences } from "../app/ui-preferences";
import {
  TypographyCard,
  UiPreferencesCard,
} from "../components/settings/SettingsCards";

export function AppearancePage() {
  const { preferences, update } = useUiPreferences();

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold tracking-tight">Appearance</h2>
      <UiPreferencesCard
        colorScheme={preferences.colorScheme}
        onAccentColorChange={(accentColor) =>
          update({ theme: { ...preferences.theme, accentColor } })
        }
        onColorSchemeChange={(colorScheme) => update({ colorScheme })}
        theme={preferences.theme}
      />
      <TypographyCard
        chatFontSize={preferences.chatFontSize}
        onChatFontSizeChange={(chatFontSize) => update({ chatFontSize })}
        onUiFontSizeChange={(uiFontSize) => update({ uiFontSize })}
        uiFontSize={preferences.uiFontSize}
      />
    </div>
  );
}
