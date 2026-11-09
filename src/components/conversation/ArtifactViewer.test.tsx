// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ArtifactPreviewData } from "../../platform/native";
import { ArtifactViewer } from "./ArtifactViewer";

const preview: ArtifactPreviewData = {
  mimeType: "image/svg+xml",
  dataUrl: "data:image/svg+xml;base64:first",
  format: "pdf",
  sheets: 2,
  rows: 4,
  columns: 1,
  byteSize: 256,
  diagnostics: ["preview truncated"],
  pages: [
    {
      label: "Page 1",
      dataUrl: "data:image/svg+xml;base64:first",
      width: 640,
      height: 480,
      diagnostics: [],
    },
    {
      label: "Page 2",
      dataUrl: "data:image/svg+xml;base64:second",
      width: 640,
      height: 480,
      diagnostics: ["unsupported image"],
    },
  ],
};

describe("ArtifactViewer", () => {
  afterEach(cleanup);

  it("navigates pages, zooms, and exposes diagnostics", () => {
    render(<ArtifactViewer preview={preview} />);

    expect(screen.getByText("Page 1 · 1/2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 · 2/2")).toBeTruthy();
    expect(screen.getByText("unsupported image")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("125%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select Page 1" }));
    expect(screen.getByText("Page 1 · 1/2")).toBeTruthy();
  });

  it("supports keyboard page navigation", () => {
    render(<ArtifactViewer preview={preview} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Select Page 1" }), {
      key: "ArrowRight",
    });
    expect(screen.getByText("Page 2 · 2/2")).toBeTruthy();
  });

  it("shows a bounded fallback page when the native payload has no pages", () => {
    render(
      <ArtifactViewer
        preview={{
          ...preview,
          pages: [],
          dataUrl: "data:image/svg+xml;base64:fallback",
        }}
      />,
    );

    expect(screen.getByText("Preview · 1/1")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Artifact preview" }).getAttribute("src"),
    ).toBe("data:image/svg+xml;base64:fallback");
  });
});
