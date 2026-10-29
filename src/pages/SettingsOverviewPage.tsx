import { useUiPreferences } from "../app/ui-preferences";
import { LanguageCard, NotificationsCard } from "../components/settings/SettingsCards";

export function SettingsOverviewPage() {
  const { preferences, update } = useUiPreferences();

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">General</h2>
      <LanguageCard
        language={preferences.language}
        onLanguageChange={(language) => update({ language })}
      />
      <NotificationsCard
        enabled={preferences.notifications.desktop}
        onEnabledChange={(desktop) =>
          update({ notifications: { ...preferences.notifications, desktop } })
        }
        onSoundChange={(sound) =>
          update({ notifications: { ...preferences.notifications, sound } })
        }
        sound={preferences.notifications.sound}
      />
    </div>
  );
}
