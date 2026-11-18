import { CodeBracketIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import { FormFieldRow } from "@/components/base/common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

export function EditorCommandCard({
  command,
  onCommandChange,
}: {
  command: string;
  onCommandChange: (command: string) => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <SettingsPanel icon={CodeBracketIcon} title={t("settings:editor")}>
      <div className="text-sm">
        <FormFieldRow controlId="settings-editor-command" label={t("settings:editorCommand")}>
          <input
            aria-label={t("settings:editorCommand")}
            aria-describedby="settings-editor-command-help"
            autoCapitalize="none"
            autoCorrect="off"
            className="input input-bordered input-sm w-full max-w-sm justify-self-end font-mono max-sm:max-w-none"
            id="settings-editor-command"
            maxLength={1024}
            name="editor-command"
            onChange={(event) => onCommandChange(event.target.value)}
            placeholder={t("settings:editorCommandAuto")}
            spellCheck={false}
            type="text"
            value={command}
          />
        </FormFieldRow>
        <p className="px-5 pb-3 text-xs text-base-content/60" id="settings-editor-command-help">
          {t("settings:editorCommandHelp")}
        </p>
      </div>
    </SettingsPanel>
  );
}
