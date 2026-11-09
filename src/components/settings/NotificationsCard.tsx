import { BellIcon } from "@heroicons/react/24/outline";

import type { UiNotificationSound } from "../../app/ui-preferences";
import { UI_NOTIFICATION_SOUND_OPTIONS } from "../../app/ui-preferences";
import { FormFieldRow } from "../common/FormFieldRow";
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
  return (
    <SettingsPanel icon={BellIcon} title="Notifications">
      <div className="text-sm">
        <FormFieldRow
          controlId="settings-desktop-notifications"
          label="Desktop notifications"
        >
          <input
            aria-label="Desktop notifications"
            className="toggle justify-self-end"
            checked={enabled}
            id="settings-desktop-notifications"
            onChange={(event) => onEnabledChange(event.target.checked)}
            type="checkbox"
          />
        </FormFieldRow>
        <FormFieldRow
          controlId="settings-notification-sound"
          label="Notification sound"
        >
          <select
            aria-label="Notification sound"
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-notification-sound"
            value={sound}
            onChange={(event) =>
              onSoundChange(event.target.value as UiNotificationSound)
            }
          >
            {UI_NOTIFICATION_SOUND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
