import {
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_UI_FONT_SIZE,
  useUiPreferences,
} from "../app/ui-preferences";
import {
  ThemeColorsCard,
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
        onThemePresetChange={(preset) =>
          update({ theme: { ...preferences.theme, preset, colors: {} } })
        }
        onColorSchemeChange={(colorScheme) => update({ colorScheme })}
        preset={preferences.theme.preset ?? "daisyui"}
      />
      <ThemeColorsCard
        colors={preferences.theme.colors ?? {}}
        onColorChange={(key, value) => {
          const colors = { ...(preferences.theme.colors ?? {}) };
          if (value.trim()) {
            colors[key] = value;
          } else {
            delete colors[key];
          }
          update({ theme: { ...preferences.theme, colors } });
        }}
      />
      <TypographyCard
        chatFontSize={preferences.chatFontSize}
        onChatFontSizeChange={(chatFontSize) => update({ chatFontSize })}
        onReset={() =>
          update({
            chatFontSize: DEFAULT_CHAT_FONT_SIZE,
            uiFontSize: DEFAULT_UI_FONT_SIZE,
          })
        }
        onUiFontSizeChange={(uiFontSize) => update({ uiFontSize })}
        uiFontSize={preferences.uiFontSize}
      />
    </div>
  );
}
