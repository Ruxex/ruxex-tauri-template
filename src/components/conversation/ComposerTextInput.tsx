import type {
  ChangeEventHandler,
  KeyboardEventHandler,
  RefObject,
} from "react";

import type { v2 } from "../../protocol";
import { AttachmentPreview } from "../common/AttachmentPreview";
import { ComposerMessageInput } from "./ComposerMessageInput";

type ComposerTextInputProps = {
  attachmentInput: RefObject<HTMLInputElement | null>;
  disabled: boolean;
  handleAttachmentChange: ChangeEventHandler<HTMLInputElement>;
  imageFile: File | null;
  onChange: (value: string) => void;
  onEditorReady: (element: HTMLElement) => void;
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
  onKeyDown,
  onRemoveImage,
  placeholder,
  value,
}: ComposerTextInputProps) {
  return (
    <>
      <ComposerMessageInput
        disabled={disabled}
        onChange={onChange}
        onEditorReady={onEditorReady}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        value={value}
      />
      <input
        ref={attachmentInput}
        accept="image/*"
        aria-label="Image attachment"
        className="hidden"
        onChange={handleAttachmentChange}
        type="file"
      />
      {imageFile && (
        <AttachmentPreview
          disabled={disabled}
          file={imageFile}
          onRemove={onRemoveImage}
        />
      )}
    </>
  );
}

export type SelectedComposerSkill = Pick<
  v2.SkillMetadata,
  "name" | "path" | "interface"
>;
