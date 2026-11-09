// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const previewArtifact = vi.hoisted(() => vi.fn());

vi.mock("../../platform/native", () => ({ previewArtifact }));

import { ArtifactPreview } from "./ArtifactPreview";

describe("ArtifactPreview", () => {
  afterEach(() => {
    cleanup();
    previewArtifact.mockReset();
  });

  it("shows a loading state while the preview is generated", () => {
    previewArtifact.mockReturnValue(new Promise(() => {}));

    render(<ArtifactPreview path="/workspace/report.xlsx" />);

    expect(screen.getByRole("status", { name: "Loading artifact preview" })).toBeTruthy();
  });

  it("renders the generated image and dimensions", async () => {
    previewArtifact.mockResolvedValue({
      mimeType: "image/svg+xml",
      dataUrl: "data:image/svg+xml;base64,preview",
      format: "xlsx",
      sheets: 2,
      rows: 4,
      columns: 3,
      byteSize: 128,
      pages: [],
      diagnostics: [],
    });

    render(<ArtifactPreview path="/workspace/report.xlsx" />);

    expect(
      (await screen.findByRole("img", { name: "Artifact preview" })).getAttribute(
        "src",
      ),
    ).toBe("data:image/svg+xml;base64,preview");
    expect(screen.getByText("2 sheets · 4 rows · 3 columns")).toBeTruthy();
  });

  it("shows an accessible error without breaking the parent activity", async () => {
    previewArtifact.mockRejectedValue(new Error("Preview is unavailable."));

    render(<ArtifactPreview path="/workspace/report.xlsx" />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Preview is unavailable.",
    );
  });

  it("describes a presentation preview as slides", async () => {
    previewArtifact.mockResolvedValue({
      mimeType: "image/svg+xml",
      dataUrl: "data:image/svg+xml;base64,preview",
      format: "pptx",
      sheets: 3,
      rows: 8,
      columns: 1,
      byteSize: 256,
      pages: [],
      diagnostics: [],
    });

    render(<ArtifactPreview path="/workspace/deck.pptx" />);

    expect(await screen.findByText("3 slides · 8 text lines")).toBeTruthy();
  });

  it("shows the first page and page count from a paged preview", async () => {
    previewArtifact.mockResolvedValue({
      mimeType: "image/svg+xml",
      dataUrl: "data:image/svg+xml;base64:first-page",
      format: "pdf",
      sheets: 2,
      rows: 4,
      columns: 1,
      byteSize: 512,
      diagnostics: [],
      pages: [
        {
          label: "Page 1",
          dataUrl: "data:image/svg+xml;base64:first-page",
          width: 640,
          height: 480,
          diagnostics: [],
        },
        {
          label: "Page 2",
          dataUrl: "data:image/svg+xml;base64:second-page",
          width: 640,
          height: 480,
          diagnostics: [],
        },
      ],
    });

    render(<ArtifactPreview path="/workspace/report.pdf" />);

    expect(await screen.findByText("2 pages · 512 bytes")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Artifact preview" }).getAttribute("src"))
      .toBe("data:image/svg+xml;base64:first-page");
  });
});
