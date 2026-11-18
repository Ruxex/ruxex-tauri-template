import { useTranslation } from "react-i18next";
import type { ChangeEventHandler, KeyboardEventHandler, RefObject } from "react";

import type { v2 } from "@/protocol";
import type { SlashCommandToken } from "./slash-command";
import { AttachmentPreview } from "@/components/base/common/AttachmentPreview";
import { ComposerMessageInput } from "./ComposerMessageInput";

type ComposerTextInputProps = {
  attachmentInput: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  handleAttachmentChange: ChangeEventHandler<HTMLInputElement>;
  imageFile: File | null;
  onChange: (value: string) => void;
  onEditorReady: (element: HTMLElement) => void;
  onSlashCommandContext?: (input: SlashCommandToken | null, removeToken: (() => void) | null) => void;
  onKeyDown: KeyboardEventHandler<HTMLDivElement>;
  onRemoveImage: () => void;
  placeholder: string;
  value: string;
};

export function ComposerTextInput({
  attachmentInput,
  disabled,
  handleAttachmentChange,
  imageFile,
  onChange,
  onEditorReady,
  onSlashCommandContext,
  onKeyDown,
  onRemoveImage,
  placeholder,
  value,
}: ComposerTextInputProps) {
  const { t } = useTranslation("conversation");

  return (
    <>
      <ComposerMessageInput
        disabled={disabled}
        onChange={onChange}
        onEditorReady={onEditorReady}
        onSlashCommandContext={onSlashCommandContext}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        value={value}
      />
      <input
        ref={attachmentInput}
        accept="image/*"
        aria-label={t("imageAttachment")}
        className="hidden"
        onChange={handleAttachmentChange}
        type="file"
      />
      {imageFile && <AttachmentPreview disabled={disabled} file={imageFile} onRemove={onRemoveImage} />}
    </>
  );
}

export type SelectedComposerSkill = Pick<v2.SkillMetadata, "name" | "path" | "interface">;
