import { useEffect, useState } from "react";

import { useUiPreferences } from "../app/ui-preferences";
import {
  LanguageCard,
  NotificationsCard,
  QuickPanelCard,
} from "../components/settings/SettingsCards";
import {
  readQuickPanelShortcut,
  updateQuickPanelShortcut,
} from "../platform/native";

export function SettingsOverviewPage() {
  const { preferences, update } = useUiPreferences();
  const [shortcut, setShortcut] = useState("");
  const [defaultShortcut, setDefaultShortcut] = useState("");
  const [isLoadingShortcut, setIsLoadingShortcut] = useState(true);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readQuickPanelShortcut()
      .then((settings) => {
        if (!active) return;
        setShortcut(settings.shortcut);
        setDefaultShortcut(settings.defaultShortcut);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setShortcutError(
          error instanceof Error
            ? error.message
            : "Unable to load quick panel shortcut.",
        );
      })
      .finally(() => {
        if (active) setIsLoadingShortcut(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveShortcut(nextShortcut = shortcut) {
    setIsSavingShortcut(true);
    setShortcutError(null);
    try {
      const settings = await updateQuickPanelShortcut(nextShortcut);
      setShortcut(settings.shortcut);
      setDefaultShortcut(settings.defaultShortcut);
    } catch (error) {
      setShortcutError(
        error instanceof Error
          ? error.message
          : "Unable to update quick panel shortcut.",
      );
    } finally {
      setIsSavingShortcut(false);
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-3xl font-semibold tracking-tight">General</h2>
      <LanguageCard
        language={preferences.language}
        onLanguageChange={(language) => update({ language })}
      />
      <QuickPanelCard
        defaultShortcut={defaultShortcut}
        disabled={isLoadingShortcut || isSavingShortcut}
        error={shortcutError}
        isLoading={isLoadingShortcut}
        onReset={() => void saveShortcut(defaultShortcut)}
        onSave={() => void saveShortcut()}
        onShortcutChange={(value) => {
          setShortcut(value);
          setShortcutError(null);
        }}
        shortcut={shortcut}
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
