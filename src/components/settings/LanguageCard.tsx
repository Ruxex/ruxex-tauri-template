import { GlobeAltIcon } from "@heroicons/react/24/outline";

import type { UiLanguage } from "../../app/ui-preferences";
import { FormFieldRow } from "../common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

export function LanguageCard({
  language,
  onLanguageChange,
}: {
  language: UiLanguage;
  onLanguageChange: (language: UiLanguage) => void;
}) {
  return (
    <SettingsPanel icon={GlobeAltIcon} title="Language">
      <div className="text-sm">
        <FormFieldRow controlId="settings-language" label="Language">
          <select
            aria-label="Language"
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-language"
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as UiLanguage)
            }
          >
            <option value="system">System default</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
