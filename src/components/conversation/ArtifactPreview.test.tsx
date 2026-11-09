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
});
