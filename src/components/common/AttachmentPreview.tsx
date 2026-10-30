import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export function AttachmentPreview({
  disabled,
  file,
  onRemove,
}: {
  disabled: boolean;
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-box border border-base-300 bg-base-200 p-2 text-sm"
      data-testid="selected-image"
    >
      {previewUrl ? (
        <img
          alt={`Selected image: ${file.name}`}
          className="size-10 rounded object-cover"
          src={previewUrl}
        />
      ) : (
        <span
          aria-hidden="true"
          className="size-10 animate-pulse rounded bg-base-300"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{file.name}</span>
      <button
        aria-label="Remove image attachment"
        className="btn btn-ghost btn-xs btn-circle text-error"
        disabled={disabled}
        onClick={onRemove}
        title="Remove image attachment"
        type="button"
      >
        <XMarkIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
