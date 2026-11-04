import { describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("branding platform bridge", () => {
  it("loads branding from the canonical Tauri command", async () => {
    invoke.mockResolvedValueOnce({
      appName: "Ruxex",
      assistantName: "Ruxex",
      windowTitle: "Ruxex Desktop",
    });
    const { getBranding } = await import("./branding");

    const first = getBranding();
    const second = getBranding();

    await expect(first).resolves.toEqual({
      appName: "Ruxex",
      assistantName: "Ruxex",
      windowTitle: "Ruxex Desktop",
    });
    await expect(second).resolves.toEqual({
      appName: "Ruxex",
      assistantName: "Ruxex",
      windowTitle: "Ruxex Desktop",
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("get_branding");
  });
});
