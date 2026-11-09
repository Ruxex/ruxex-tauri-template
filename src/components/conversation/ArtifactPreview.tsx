import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import { formatErrorMessage } from "../../app/error-message";
import {
  type ArtifactPreviewData,
  openArtifact,
  previewArtifact,
  saveArtifact,
} from "../../platform/native";
import { ArtifactViewer } from "./ArtifactViewer";

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
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setPreview(null);
    setError(null);
    setSaveError(null);
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
      <p
        aria-label="Artifact preview error"
        className="my-3 text-sm text-error"
        role="alert"
      >
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

  const handleSave = async () => {
    setSaveError(null);
    const destination = await save({
      defaultPath: path,
      filters: [
        {
          name: `${preview.format.toUpperCase()} artifact`,
          extensions: [preview.format],
        },
      ],
    });
    if (!destination) return;
    try {
      await saveArtifact(path, destination);
    } catch (reason: unknown) {
      setSaveError(
        reason instanceof Error ? reason.message : formatErrorMessage(reason),
      );
    }
  };

  return (
    <figure className="my-3 overflow-auto rounded-box border border-base-300 bg-base-200 p-2">
      <ArtifactViewer preview={preview} />
      <button
        className="btn btn-xs btn-outline mt-2"
        onClick={() => void openArtifact(path)}
        type="button"
      >
        Open file
      </button>
      <button
        className="btn btn-xs btn-outline mt-2 ml-2"
        onClick={() => void handleSave()}
        type="button"
      >
        Save a copy
      </button>
      {saveError && (
        <p className="mt-2 text-xs text-error" role="alert">
          {saveError}
        </p>
      )}
      <figcaption className="px-2 py-1 text-xs text-base-content/60">
        {preview.format === "xlsx"
          ? `${preview.sheets} sheets · ${preview.rows} rows · ${preview.columns} columns`
          : preview.format === "pptx"
            ? `${preview.sheets} slides · ${preview.rows} text lines`
            : preview.format === "pdf"
              ? `${preview.pages.length} pages · ${preview.byteSize} bytes`
              : `Document · ${preview.rows} text lines`}
        {preview.diagnostics.length > 0 && (
          <span className="ml-2">
            · {preview.diagnostics.length} diagnostics
          </span>
        )}
      </figcaption>
    </figure>
  );
}
