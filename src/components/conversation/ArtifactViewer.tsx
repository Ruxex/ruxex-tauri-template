import { useEffect, useMemo, useState } from "react";

import type {
  ArtifactPreviewData,
  ArtifactPreviewPage,
} from "../../platform/native";

type ArtifactViewerProps = {
  preview: ArtifactPreviewData;
};

const fallbackPage = (preview: ArtifactPreviewData): ArtifactPreviewPage => ({
  label: "Preview",
  dataUrl: preview.dataUrl,
  width: 640,
  height: 480,
  diagnostics: preview.diagnostics,
});

export function ArtifactViewer({ preview }: ArtifactViewerProps) {
  const pages = useMemo(
    () => (preview.pages.length > 0 ? preview.pages : [fallbackPage(preview)]),
    [preview],
  );
  const previewKey = `${preview.dataUrl}:${pages.map((item) => item.dataUrl).join(",")}`;
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const page = pages[Math.min(pageIndex, pages.length - 1)];

  useEffect(() => {
    if (!previewKey) return;
    setPageIndex(0);
    setZoom(1);
  }, [previewKey]);

  const selectPage = (nextIndex: number) => {
    setPageIndex(Math.max(0, Math.min(nextIndex, pages.length - 1)));
  };

  return (
    <section aria-label="Artifact viewer" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-label="Previous page"
          className="btn btn-xs btn-outline"
          disabled={pageIndex === 0}
          onClick={() => selectPage(pageIndex - 1)}
          type="button"
        >
          Previous
        </button>
        <span className="text-xs text-base-content/60">
          {page.label} · {pageIndex + 1}/{pages.length}
        </span>
        <button
          aria-label="Next page"
          className="btn btn-xs btn-outline"
          disabled={pageIndex === pages.length - 1}
          onClick={() => selectPage(pageIndex + 1)}
          type="button"
        >
          Next
        </button>
        <button
          aria-label="Zoom out"
          className="btn btn-xs btn-ghost"
          disabled={zoom <= 0.5}
          onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
          type="button"
        >
          −
        </button>
        <span className="text-xs text-base-content/60">
          {Math.round(zoom * 100)}%
        </span>
        <button
          aria-label="Zoom in"
          className="btn btn-xs btn-ghost"
          disabled={zoom >= 2}
          onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
          type="button"
        >
          +
        </button>
        <button
          aria-label="Fit width"
          className="btn btn-xs btn-ghost"
          onClick={() => setZoom(1)}
          type="button"
        >
          Fit width
        </button>
      </div>
      <fieldset
        aria-label="Artifact pages"
        className="flex gap-1 overflow-x-auto pb-1"
      >
        <legend className="sr-only">Artifact pages</legend>
        {pages.map((item, index) => (
          <button
            aria-label={`Select ${item.label}`}
            aria-pressed={index === pageIndex}
            className={`shrink-0 rounded border p-0.5 ${index === pageIndex ? "border-primary" : "border-base-300"}`}
            key={`${item.label}-${item.dataUrl}`}
            onClick={() => selectPage(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectPage(index - 1);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                selectPage(index + 1);
              }
            }}
            type="button"
          >
            <img
              alt=""
              className="h-12 w-16 object-contain"
              src={item.dataUrl}
            />
          </button>
        ))}
      </fieldset>
      <div className="overflow-auto rounded-box border border-base-300 bg-base-200 p-2">
        <img
          alt="Artifact preview"
          className="mx-auto max-w-none object-contain"
          src={page.dataUrl}
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
      {(preview.diagnostics.length > 0 || page.diagnostics.length > 0) && (
        <ul aria-label="Artifact diagnostics" className="text-xs text-warning">
          {[...preview.diagnostics, ...page.diagnostics].map((diagnostic) => (
            <li key={`${page.label}-${diagnostic}`}>{diagnostic}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
