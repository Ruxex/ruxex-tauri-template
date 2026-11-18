import { useTranslation } from "react-i18next";
import { BellIcon } from "@heroicons/react/24/outline";

import type { UiNotificationSound } from "@/app/ui-preferences";
import { UI_NOTIFICATION_SOUND_OPTIONS } from "@/app/ui-preferences";
import { FormFieldRow } from "@/components/base/common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

export function NotificationsCard({
  enabled,
  onEnabledChange,
  sound,
  onSoundChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  sound: UiNotificationSound;
  onSoundChange: (sound: UiNotificationSound) => void;
}) {
  const { t } = useTranslation("settings");
  return (
    <SettingsPanel icon={BellIcon} title={t("settings:notifications")}>
      <div className="text-sm">
        <FormFieldRow controlId="settings-desktop-notifications" label={t("settings:desktopNotifications")}>
          <input
            aria-label={t("settings:desktopNotifications")}
            className="toggle justify-self-end"
            checked={enabled}
            id="settings-desktop-notifications"
            onChange={(event) => onEnabledChange(event.target.checked)}
            type="checkbox"
          />
        </FormFieldRow>
        <FormFieldRow controlId="settings-notification-sound" label={t("settings:notificationSound")}>
          <select
            aria-label={t("settings:notificationSound")}
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-notification-sound"
            value={sound}
            onChange={(event) => onSoundChange(event.target.value as UiNotificationSound)}
          >
            {UI_NOTIFICATION_SOUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(`settings:notificationSounds.${option.value}`)}
              </option>
            ))}
          </select>
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
