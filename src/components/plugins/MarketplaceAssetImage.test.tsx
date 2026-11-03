// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const readMarketplaceAsset = vi.hoisted(() => vi.fn());
const readLocalMarketplaceAsset = vi.hoisted(() => vi.fn());

vi.mock("../../platform/native", () => ({
  readLocalMarketplaceAsset,
  readMarketplaceAsset,
}));

import { MarketplaceAssetImage } from "./MarketplaceAssetImage";
import {
  clearMarketplaceAssetCacheForTests,
  loadLocalMarketplaceAsset,
  loadMarketplaceAsset,
} from "./marketplace-asset-loader";
import { validateMarketplaceAssetUrl } from "./marketplace-asset-policy";

describe("MarketplaceAssetImage", () => {
  afterEach(() => {
    cleanup();
    clearMarketplaceAssetCacheForTests();
    readMarketplaceAsset.mockReset();
    readLocalMarketplaceAsset.mockReset();
    vi.restoreAllMocks();
  });

  it("accepts only HTTPS GitHub asset URLs without URL boundary escapes", () => {
    expect(
      validateMarketplaceAssetUrl(
        "https://raw.githubusercontent.com/acme/plugin/main/assets/logo.svg",
      ),
    ).not.toBeNull();
    expect(
      validateMarketplaceAssetUrl(
        "https://github.com/acme/plugin/main/assets/logo.svg",
      ),
    ).not.toBeNull();

    for (const value of [
      "http://raw.githubusercontent.com/acme/plugin/main/logo.svg",
      "https://raw.githubusercontent.com.evil/acme/plugin/main/logo.svg",
      "https://user@raw.githubusercontent.com/acme/plugin/main/logo.svg",
      "https://raw.githubusercontent.com:444/acme/plugin/main/logo.svg",
      "https://raw.githubusercontent.com/acme/plugin/main/logo.svg?x=1",
      "https://raw.githubusercontent.com/acme/plugin/main/logo.svg#x",
      "https://raw.githubusercontent.com/acme/plugin/main/%2e%2e/logo.svg",
      "https://example.com/acme/plugin/main/logo.svg",
    ]) {
      expect(validateMarketplaceAssetUrl(value)).toBeNull();
    }
  });

  it("delegates validated assets to the native Tauri boundary", async () => {
    readMarketplaceAsset.mockResolvedValueOnce("data:image/png;base64,AA==");

    await expect(
      loadMarketplaceAsset(
        "https://raw.githubusercontent.com/acme/plugin/main/logo.png",
      ),
    ).resolves.toBe("data:image/png;base64,AA==");
    expect(readMarketplaceAsset).toHaveBeenCalledWith(
      "https://raw.githubusercontent.com/acme/plugin/main/logo.png",
    );
  });

  it("prefers a local path and delegates it to the native Tauri boundary", async () => {
    readLocalMarketplaceAsset.mockResolvedValueOnce("data:image/svg+xml;base64,AA==");

    await expect(
      loadLocalMarketplaceAsset("/home/user/.ruxex_desktop/marketplace-assets/logo.svg"),
    ).resolves.toBe("data:image/svg+xml;base64,AA==");
    expect(readLocalMarketplaceAsset).toHaveBeenCalledWith(
      "/home/user/.ruxex_desktop/marketplace-assets/logo.svg",
    );
    expect(readMarketplaceAsset).not.toHaveBeenCalled();
  });

  it("surfaces native validation failures without using browser fetch", async () => {
    readMarketplaceAsset.mockRejectedValueOnce(
      new Error("The marketplace image response was not allowed."),
    );

    await expect(
      loadMarketplaceAsset(
        "https://raw.githubusercontent.com/acme/plugin/main/logo.svg",
      ),
    ).rejects.toThrow("response was not allowed");
    expect(readMarketplaceAsset).toHaveBeenCalledTimes(1);
  });

  it("renders only after native validation returns image data", async () => {
    readMarketplaceAsset.mockResolvedValueOnce("data:image/png;base64,AA==");

    render(
      <MarketplaceAssetImage
        alt="Plugin logo"
        src="https://raw.githubusercontent.com/acme/plugin/main/logo.png"
      />,
    );

    expect(screen.getByRole("status")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("img")).toBeTruthy());
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "data:image/png;base64,AA==",
    );
  });
});
