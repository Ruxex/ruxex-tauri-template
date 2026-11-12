import { useEffect, useState } from "react";

import { readVisualizationFile } from "../../platform/native";
import type { VisualizeReference } from "./visualize-reference";

const MAX_HTML_BYTES = 1024 * 1024;

type VisualizeFrameProps = {
  reference: VisualizeReference;
  loadHtml?: (path: string) => Promise<string>;
};

export function VisualizeFrame({ reference, loadHtml }: VisualizeFrameProps) {
  const [state, setState] = useState<
    { status: "loading" } |
      { status: "ready"; srcDoc: string } |
      { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    const readHtml = loadHtml ?? readVisualizationFile;

    void readHtml(reference.path)
      .then((html) => {
        if (cancelled) return;
        if (new TextEncoder().encode(html).byteLength > MAX_HTML_BYTES) {
          setState({ status: "error", message: "Visualization is too large." });
          return;
        }
        setState({ status: "ready", srcDoc: createSandboxDocument(html) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Unable to load visualization.";
        setState({
          status: "error",
          message:
            message === "Visualization is too large."
              ? message
              : "Unable to load visualization.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [loadHtml, reference.path]);

  if (state.status === "loading") {
    return <p className="py-4 text-sm text-base-content/60">Loading visualization…</p>;
  }

  if (state.status === "error") {
    return (
      <p className="alert alert-error" role="alert">
        {state.message}
      </p>
    );
  }

  return (
    <iframe
      className={`h-96 w-full border-0 ${reference.mode === "wide" ? "max-w-[1024px]" : "max-w-[736px]"}`}
      sandbox="allow-scripts"
      srcDoc={state.srcDoc}
      title="Visualization"
    />
  );
}

function createSandboxDocument(fragment: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';">
    <style>html,body{margin:0;min-height:100%;}body{font-family:system-ui,sans-serif;overflow-wrap:anywhere;}</style>
  </head>
  <body>${fragment}</body>
</html>`;
}
