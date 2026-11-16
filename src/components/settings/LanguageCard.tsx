import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("settings");
  return (
    <SettingsPanel icon={GlobeAltIcon} title={t("settings:language")}>
      <div className="text-sm">
        <FormFieldRow
          controlId="settings-language"
          label={t("settings:language")}
        >
          <select
            aria-label={t("settings:language")}
            className="select select-bordered select-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-language"
            value={language}
            onChange={(event) =>
              onLanguageChange(event.target.value as UiLanguage)
            }
          >
            <option value="system">{t("settings:systemDefault")}</option>
            <option lang="en" value="en">
              English
            </option>
            <option lang="ja" value="ja">
              日本語
            </option>
          </select>
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
