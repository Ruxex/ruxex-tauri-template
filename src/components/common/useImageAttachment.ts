import { useRef, useState, type ChangeEvent } from "react";

export function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Unable to read image attachment."));
      }
    });
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Unable to read image attachment.")),
    );
    reader.readAsDataURL(file);
  });
}

export function useImageAttachment() {
  const attachmentInput = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file && !file.type.startsWith("image/")) {
      setImageFile(null);
      setAttachmentError("Only image attachments are supported.");
      event.target.value = "";
      return;
    }
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
    clearAttachment();
    setAttachmentError(null);
  }

  return {
    attachmentError,
    attachmentInput,
    clearAttachment,
    handleAttachmentChange,
    imageFile,
    readImage: readImageDataUrl,
    resetAttachment,
    setAttachmentError,
  };
}
