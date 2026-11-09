import { useEffect, useState } from "react";

import { formatErrorMessage } from "../../app/error-message";
import {
  previewArtifact,
  type ArtifactPreviewData,
} from "../../platform/native";

type ArtifactPreviewProps = {
  path: string;
  loadPreview?: (path: string) => Promise<ArtifactPreviewData>;
};

export function ArtifactPreview({
  path,
  loadPreview = previewArtifact,
}: ArtifactPreviewProps) {
  const [preview, setPreview] = useState<ArtifactPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPreview(null);
    setError(null);
    void loadPreview(path)
      .then((nextPreview) => {
        if (active) setPreview(nextPreview);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : formatErrorMessage(reason),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [loadPreview, path]);

  if (error) {
    return (
      <p aria-label="Artifact preview error" className="my-3 text-sm text-error" role="alert">
        {error}
      </p>
    );
  }

  if (!preview) {
    return (
      <span
        aria-label="Loading artifact preview"
        className="loading loading-spinner my-4"
        role="status"
      />
    );
  }

  return (
    <figure className="my-3 overflow-auto rounded-box border border-base-300 bg-base-200 p-2">
      <img
        alt="Artifact preview"
        className="max-w-full object-contain"
        src={preview.dataUrl}
      />
      <figcaption className="px-2 py-1 text-xs text-base-content/60">
        {preview.sheets} sheets · {preview.rows} rows · {preview.columns} columns
      </figcaption>
    </figure>
  );
}
