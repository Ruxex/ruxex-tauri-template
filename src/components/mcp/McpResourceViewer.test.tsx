// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { v2 } from "../../protocol";
import { McpResourceViewer } from "./McpResourceViewer";

describe("McpResourceViewer", () => {
  it("renders text as safe formatted content", () => {
    const response: v2.McpResourceReadResponse = {
      contents: [
        {
          uri: "resource://guide",
          mimeType: "application/json",
          text: '{"title":"<script>alert(1)</script>"}',
        },
      ],
    };

    render(<McpResourceViewer response={response} />);

    const text = screen.getByTestId("mcp-resource-text");
    expect(text.tagName).toBe("PRE");
    expect(text.textContent).toContain('"title": "<script>alert(1)</script>"');
    expect(text.querySelector("script")).toBeNull();
  });

  it("shows blob metadata without decoding the payload", () => {
    const response: v2.McpResourceReadResponse = {
      contents: [
        {
          uri: "resource://binary",
          mimeType: "application/octet-stream",
          blob: "c2VjcmV0",
        },
      ],
    };

    render(<McpResourceViewer response={response} />);

    expect(screen.getByText("Binary content")).toBeTruthy();
    expect(screen.getByText("application/octet-stream")).toBeTruthy();
    expect(screen.getByText("8 base64 characters")).toBeTruthy();
    expect(screen.queryByText("secret")).toBeNull();
  });

  it("renders empty and error states distinctly", () => {
    const { rerender } = render(
      <McpResourceViewer response={{ contents: [] }} />,
    );
    expect(screen.getByRole("status").textContent).toContain(
      "No Resource content",
    );

    rerender(<McpResourceViewer error={new Error("Resource unavailable")} />);
    expect(screen.getByRole("alert").textContent).toContain(
      "Resource unavailable",
    );
  });
});
