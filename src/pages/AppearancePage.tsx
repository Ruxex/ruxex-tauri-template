import {
  DEFAULT_CHAT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
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
        onThemePresetChange={(preset) =>
          update({ theme: { ...preferences.theme, preset, colors: {} } })
        }
        preset={preferences.theme.preset ?? "system"}
      />
      <ThemeColorsCard
        colors={preferences.theme.colors ?? {}}
        onReset={() => update({ theme: { ...preferences.theme, colors: {} } })}
        onColorChange={(key, value) => {
          const colors = { ...(preferences.theme.colors ?? {}) };
          if (value.trim()) {
            colors[key] = value;
          } else {
            delete colors[key];
          }
          update({ theme: { ...preferences.theme, colors } });
        }}
        preset={preferences.theme.preset ?? "system"}
      />
      <TypographyCard
        chatFontFamily={preferences.chatFontFamily}
        chatFontSize={preferences.chatFontSize}
        onChatFontFamilyChange={(chatFontFamily) => update({ chatFontFamily })}
        onChatFontSizeChange={(chatFontSize) => update({ chatFontSize })}
        onReset={() =>
          update({
            chatFontFamily: DEFAULT_FONT_FAMILY,
            chatFontSize: DEFAULT_CHAT_FONT_SIZE,
            uiFontFamily: DEFAULT_FONT_FAMILY,
            uiFontSize: DEFAULT_UI_FONT_SIZE,
          })
        }
        onUiFontFamilyChange={(uiFontFamily) => update({ uiFontFamily })}
        onUiFontSizeChange={(uiFontSize) => update({ uiFontSize })}
        uiFontFamily={preferences.uiFontFamily}
        uiFontSize={preferences.uiFontSize}
      />
    </div>
  );
}
