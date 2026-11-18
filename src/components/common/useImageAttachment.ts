import { useRef, useState, type ChangeEvent } from "react";

import { useTranslation } from "react-i18next";
import { AppUiError, formatErrorMessage } from "../../app/error-message";

function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new AppUiError("imageReadFailed"));
      }
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new AppUiError("imageReadFailed")),
    );
    reader.readAsDataURL(file);
  });
}

export function useImageAttachment() {
  const { t } = useTranslation("common");
  const [invalidType, setInvalidType] = useState(false);
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | Error | null>(
    null,
  );

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && !file.type.startsWith("image/")) {
      setImageFile(null);
      setInvalidType(true);
      setAttachmentError(null);
      event.target.value = "";
      return;
    }
    setInvalidType(false);
    setImageFile(file);
    setAttachmentError(null);
  }

  function clearAttachment() {
    setImageFile(null);
    if (attachmentInput.current) {
      attachmentInput.current.value = "";
    }
  }

  function resetAttachment() {
    setInvalidType(false);
    clearAttachment();
    setAttachmentError(null);
  }

  return {
    attachmentError: invalidType
      ? t("imageOnlySupported")
      : attachmentError instanceof AppUiError
        ? formatErrorMessage(attachmentError)
        : attachmentError instanceof Error
          ? attachmentError.message
          : attachmentError,
    attachmentInput,
    clearAttachment,
    handleAttachmentChange,
    imageFile,
    readImage: readImageDataUrl,
    resetAttachment,
    setAttachmentError,
  };
}
