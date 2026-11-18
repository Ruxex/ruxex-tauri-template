import type { Story } from "@ladle/react";
import { useRef } from "react";
import { ComposerTextInput } from "./ComposerTextInput";

export const Empty: Story = () => {
  const attachmentInput = useRef<HTMLInputElement>(null);
  return (
    <div className="max-w-3xl rounded-box border border-base-300 bg-base-100 p-4">
      <ComposerTextInput
        attachmentInput={attachmentInput}
        disabled={false}
        handleAttachmentChange={() => undefined}
        imageFile={null}
        onChange={() => undefined}
        onEditorReady={() => undefined}
        onKeyDown={() => undefined}
        onRemoveImage={() => undefined}
        placeholder="Write a message…"
        value=""
      />
    </div>
  );
};
