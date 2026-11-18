import { useTranslation } from "react-i18next";
import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import { formatErrorMessage } from "@/app/error-message";
import { type ArtifactPreviewData, openArtifact, previewArtifact, saveArtifact } from "@/platform/native";
import { ArtifactViewer } from "./ArtifactViewer";

type ArtifactPreviewProps = {
  path: string;
  loadPreview?: (path: string) => Promise<ArtifactPreviewData>;
};

export function ArtifactPreview({ path, loadPreview = previewArtifact }: ArtifactPreviewProps) {
  const { t } = useTranslation("conversation");

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
          setError(reason instanceof Error ? reason.message : formatErrorMessage(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [loadPreview, path]);

  if (error) {
    return (
      <p aria-label={t("artifactPreviewError")} className="my-3 text-sm text-error" role="alert">
        {error}
      </p>
    );
  }

  if (!preview) {
    return <span aria-label={t("loadingArtifactPreview")} className="loading loading-spinner my-4" role="status" />;
  }

  const diagnostics = preview.diagnostics ?? [];
  const pages = preview.pages ?? [];

  const handleSave = async () => {
    setSaveError(null);
    const destination = await save({
      defaultPath: path,
      filters: [
        {
          name: t("artifactLabel", { format: preview.format.toUpperCase() }),
          extensions: [preview.format],
        },
      ],
    });
    if (!destination) return;
    try {
      await saveArtifact(path, destination);
    } catch (reason: unknown) {
      setSaveError(reason instanceof Error ? reason.message : formatErrorMessage(reason));
    }
  };

  return (
    <figure className="my-3 overflow-auto rounded-box border border-base-300 bg-base-200 p-2">
      <ArtifactViewer preview={preview} />
      <button
        aria-label={t("openArtifactFile")}
        className="btn btn-xs btn-outline mt-2"
        onClick={() => void openArtifact(path)}
        type="button"
      >
        {t("openFile")}
      </button>
      <button
        aria-label={t("saveACopyOfTheArtifact")}
        className="btn btn-xs btn-outline mt-2 ml-2"
        onClick={() => void handleSave()}
        type="button"
      >
        {t("saveACopy")}
      </button>
      {saveError && (
        <p className="mt-2 text-xs text-error" role="alert">
          {saveError}
        </p>
      )}
      <figcaption className="px-2 py-1 text-xs text-base-content/60">
        {preview.format === "xlsx"
          ? t("spreadsheetCaption", {
              count: preview.sheets,
              rows: preview.rows,
              columns: preview.columns,
            })
          : preview.format === "pptx"
            ? t("presentationCaption", {
                count: preview.sheets,
                lines: preview.rows,
              })
            : preview.format === "pdf"
              ? t("pdfCaption", {
                  count: pages.length,
                  bytes: preview.byteSize,
                })
              : t("documentCaption", { count: preview.rows })}
        {diagnostics.length > 0 && <span className="ml-2">{t("diagnosticCount", { count: diagnostics.length })}</span>}
      </figcaption>
    </figure>
  );
}
