// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const readLocalMarketplaceAsset = vi.hoisted(() => vi.fn());
const readMarketplaceAsset = vi.hoisted(() => vi.fn());

vi.mock("../../platform/native", () => ({
  readLocalMarketplaceAsset,
  readMarketplaceAsset,
}));

import type { v2 } from "../../protocol";
import { SkillIcon } from "./SkillIcon";

describe("SkillIcon", () => {
  afterEach(() => {
    cleanup();
    readLocalMarketplaceAsset.mockReset();
    readMarketplaceAsset.mockReset();
  });

  const skill: Pick<v2.SkillMetadata, "name" | "interface"> = {
    name: "documents",
    interface: {
      iconSmall: "/home/user/.agents/skills/documents/assets/icon.svg",
      iconSmallUrl: null,
      iconLargeUrl: null,
    },
  };

  it("loads the small local interface icon through the native asset boundary", async () => {
    readLocalMarketplaceAsset.mockResolvedValueOnce(
      "data:image/svg+xml;base64,AA==",
    );

    render(<SkillIcon skill={skill} />);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "documents icon" })).toBeTruthy(),
    );
    expect(readLocalMarketplaceAsset).toHaveBeenCalledWith(
      "/home/user/.agents/skills/documents/assets/icon.svg",
    );
  });

  it("keeps a loaded interface icon inside a fixed non-shrinking frame", async () => {
    readLocalMarketplaceAsset.mockResolvedValueOnce(
      "data:image/svg+xml;base64,AA==",
    );

    render(<SkillIcon className="size-6 shrink-0" skill={skill} />);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "documents icon" })).toBeTruthy(),
    );

    const frame = screen.getByTestId("skill-icon-frame");
    expect(frame.className).toContain("size-6");
    expect(frame.className).toContain("shrink-0");
    expect(frame.className).toContain("overflow-hidden");
    expect(screen.getByRole("img").className).toContain("size-full");
  });

  it("falls back to the large icon when no small icon is available", async () => {
    readLocalMarketplaceAsset.mockResolvedValueOnce(
      "data:image/svg+xml;base64,AA==",
    );
    render(
      <SkillIcon
        skill={{
          name: "pdf",
          interface: {
            iconLarge: "/home/user/.agents/skills/pdf/assets/icon-large.svg",
            iconSmallUrl: null,
            iconLargeUrl: null,
          },
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "pdf icon" })).toBeTruthy(),
    );
    expect(readLocalMarketplaceAsset).toHaveBeenCalledWith(
      "/home/user/.agents/skills/pdf/assets/icon-large.svg",
    );
  });

  it("uses the generic Skill icon when interface metadata has no icon", () => {
    render(<SkillIcon skill={{ name: "review", interface: null }} />);

    expect(screen.getByTestId("skill-icon-fallback")).toBeTruthy();
  });
});
