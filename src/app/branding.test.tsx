// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BrandingProvider } from "./branding";
import { useBranding } from "./branding-context";

const getBranding = vi.hoisted(() => vi.fn());

vi.mock("../app-server/runtime", () => ({ isNativeDesktopRuntime: true }));
vi.mock("../platform/branding", () => ({ getBranding }));

function BrandingConsumer() {
  const branding = useBranding();
  return <span>{branding?.assistantName ?? "loading"}</span>;
}

describe("BrandingProvider", () => {
  it("loads the native branding into the React context", async () => {
    getBranding.mockResolvedValueOnce({
      appName: "Ruxex",
      assistantName: "Ruxex",
      windowTitle: "Ruxex Desktop",
    });
    render(
      <BrandingProvider>
        <BrandingConsumer />
      </BrandingProvider>,
    );

    await waitFor(() => expect(screen.getByText("Ruxex")).toBeTruthy());
    expect(getBranding).toHaveBeenCalledTimes(1);
  });
});
