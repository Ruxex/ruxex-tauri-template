// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VisualizeFrame } from "./VisualizeFrame";

const reference = { path: "/workspace/chart.html", mode: "regular" as const };

describe("VisualizeFrame", () => {
  afterEach(cleanup);

  it("shows a loading state and then renders HTML in a sandboxed iframe", async () => {
    render(
      <VisualizeFrame
        loadHtml={async () => "<div id='chart'>Chart</div>"}
        reference={reference}
      />,
    );

    expect(screen.getByText("Loading visualization…")).toBeTruthy();

    const frame = await screen.findByTitle("Visualization");
    await waitFor(() => expect(frame.getAttribute("srcdoc")).toContain("Chart"));
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("connect-src 'none'");
  });

  it("applies wide layout and renders loader failures safely", async () => {
    const { rerender } = render(
      <VisualizeFrame
        loadHtml={async () => {
          throw new Error("missing");
        }}
        reference={{ ...reference, mode: "wide" }}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Unable to load visualization.",
    );

    rerender(
      <VisualizeFrame
        loadHtml={async () => "x".repeat(1024 * 1024 + 1)}
        reference={reference}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Visualization is too large.",
    );
  });
});
