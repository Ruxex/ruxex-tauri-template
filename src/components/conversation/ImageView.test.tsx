// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const readImageFile = vi.hoisted(() => vi.fn());

vi.mock("../../platform/native", () => ({ readImageFile }));

import { ImageView } from "./ImageView";

describe("ImageView", () => {
  afterEach(() => {
    cleanup();
    readImageFile.mockReset();
  });

  it("loads a validated local image as a data URL", async () => {
    readImageFile.mockResolvedValueOnce("data:image/png;base64,AA==");

    render(<ImageView path="/workspace/capture.png" />);

    await waitFor(() => expect(screen.getByRole("img")).toBeTruthy());
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "data:image/png;base64,AA==",
    );
  });

  it("shows a readable error when the native image boundary rejects", async () => {
    readImageFile.mockRejectedValueOnce(new Error("path is outside workspace"));

    render(<ImageView path="/tmp/secret.png" />);

    await waitFor(() =>
      expect(screen.getByText("path is outside workspace")).toBeTruthy(),
    );
  });
});
