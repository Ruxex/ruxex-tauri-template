import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

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

function shortcutKeyFromEvent(
  event: ReactKeyboardEvent<HTMLInputElement>,
): string | null {
  const modifierOnlyKeys = new Set([
    "Alt",
    "AltGraph",
    "Control",
    "Meta",
    "OS",
    "Shift",
  ]);
  if (modifierOnlyKeys.has(event.key)) {
    return null;
  }

  const platform = navigator.platform.toLowerCase();
  const isApple = platform.includes("mac") || platform.includes("iphone");
  const modifiers: string[] = [];
  if (event.ctrlKey) {
    modifiers.push(isApple ? "Ctrl" : "CmdOrCtrl");
  }
  if (event.metaKey) {
    modifiers.push(isApple ? "CmdOrCtrl" : "Super");
  }
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");

  const code = event.code || event.key;
  if (!code) return null;
  let key = code;
  if (code.startsWith("Key") && code.length === 4) {
    key = code.slice(3);
  } else if (code.startsWith("Digit") && code.length === 6) {
    key = code.slice(5);
  }
  if (key.length === 1) key = key.toUpperCase();

  return [...modifiers, key].join("+");
}

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

  function handleShortcutKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    event.preventDefault();
    const nextShortcut = shortcutKeyFromEvent(event);
    if (nextShortcut) {
      setShortcut(nextShortcut);
      setShortcutError(null);
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
        onShortcutKeyDown={handleShortcutKeyDown}
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
