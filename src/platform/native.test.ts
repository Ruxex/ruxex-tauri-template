import { describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("native platform bridge", () => {
  it("reads an image through the validated desktop command", async () => {
    invoke.mockResolvedValueOnce("data:image/png;base64,AA==");
    const { readImageFile } = await import("./native");

    await expect(readImageFile("/workspace/capture.png")).resolves.toBe(
      "data:image/png;base64,AA==",
    );
    expect(invoke).toHaveBeenCalledWith("read_image_file", {
      path: "/workspace/capture.png",
    });
  });

  it("opens only an explicit browser URL command", async () => {
    const { openBrowserWindow } = await import("./native");

    await openBrowserWindow("https://example.test/session");

    expect(invoke).toHaveBeenCalledWith("open_browser_window", {
      url: "https://example.test/session",
    });
  });

  it("reads and updates the native quick panel shortcut", async () => {
    invoke.mockResolvedValueOnce({
      shortcut: "CmdOrCtrl+Alt+R",
      defaultShortcut: "CmdOrCtrl+Shift+Space",
    });
    const { readQuickPanelShortcut, updateQuickPanelShortcut } = await import(
      "./native"
    );

    await expect(readQuickPanelShortcut()).resolves.toEqual({
      shortcut: "CmdOrCtrl+Alt+R",
      defaultShortcut: "CmdOrCtrl+Shift+Space",
    });
    await updateQuickPanelShortcut("CmdOrCtrl+Alt+T");

    expect(invoke).toHaveBeenLastCalledWith("quick_panel_shortcut_update", {
      shortcut: "CmdOrCtrl+Alt+T",
    });
  });
});
