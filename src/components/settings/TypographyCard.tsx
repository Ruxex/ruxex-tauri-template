import { Bars3BottomLeftIcon } from "@heroicons/react/24/outline";

import type { UiFontSize } from "../../app/ui-preferences";
import {
  clampUiFontSize,
  UI_FONT_SIZE_MAX,
  UI_FONT_SIZE_MIN,
} from "../../app/ui-preferences";
import { FormFieldRow } from "../common/FormFieldRow";
import { SettingsPanel } from "./SettingsPanel";

export function TypographyCard({
  chatFontSize,
  uiFontSize,
  onChatFontSizeChange,
  onUiFontSizeChange,
}: {
  chatFontSize: UiFontSize;
  uiFontSize: UiFontSize;
  onChatFontSizeChange: (fontSize: UiFontSize) => void;
  onUiFontSizeChange: (fontSize: UiFontSize) => void;
}) {
  return (
    <SettingsPanel icon={Bars3BottomLeftIcon} title="Typography">
      <div className="divide-y divide-base-300 text-sm">
        <FormFieldRow
          controlId="settings-chat-font-size"
          label="Chat font size"
        >
          <input
            aria-label="Chat font size"
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-chat-font-size"
            max={UI_FONT_SIZE_MAX}
            min={UI_FONT_SIZE_MIN}
            onBlur={() => onChatFontSizeChange(clampUiFontSize(chatFontSize))}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onChatFontSizeChange(value);
            }}
            step="1"
            type="number"
            value={chatFontSize}
          />
        </FormFieldRow>
        <FormFieldRow controlId="settings-ui-font-size" label="UI font size">
          <input
            aria-label="UI font size"
            className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
            id="settings-ui-font-size"
            max={UI_FONT_SIZE_MAX}
            min={UI_FONT_SIZE_MIN}
            onBlur={() => onUiFontSizeChange(clampUiFontSize(uiFontSize))}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value)) onUiFontSizeChange(value);
            }}
            step="1"
            type="number"
            value={uiFontSize}
          />
        </FormFieldRow>
      </div>
    </SettingsPanel>
  );
}
