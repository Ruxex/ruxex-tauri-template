import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import {
  closeQuickPanel,
  detectEditorCommand,
  openArtifact,
  openBrowserWindow,
  openWorkspaceInEditor,
  previewArtifact,
  readImageFile,
  readLocalMarketplaceAsset,
  readMarketplaceAsset,
  readQuickPanelShortcut,
  readVisualizationFile,
  saveArtifact,
  updateQuickPanelShortcut,
} from "./native";

describe("native Tauri command adapters", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue(undefined);
  });

  it("maps each desktop operation to its command and payload", async () => {
    await previewArtifact("/tmp/report.xlsx");
    await openArtifact("/tmp/report.xlsx");
    await openWorkspaceInEditor("/workspace", "code");
    await detectEditorCommand();
    await saveArtifact("/tmp/report.xlsx", "/workspace/report.xlsx");
    await readImageFile("/workspace/image.png");
    await readVisualizationFile("/workspace/chart.html");
    await readMarketplaceAsset("https://example.com/image.png");
    await readLocalMarketplaceAsset("/workspace/image.png");
    await openBrowserWindow("https://example.com");
    await closeQuickPanel();
    await readQuickPanelShortcut();
    await updateQuickPanelShortcut("CmdOrCtrl+Alt+R");

    expect(invoke.mock.calls).toEqual([
      ["preview_artifact", { path: "/tmp/report.xlsx" }],
      ["open_artifact", { path: "/tmp/report.xlsx" }],
      ["open_workspace_in_editor", { workspace: "/workspace", editorCommand: "code" }],
      ["detect_editor_command"],
      ["save_artifact", { path: "/tmp/report.xlsx", destination: "/workspace/report.xlsx" }],
      ["read_image_file", { path: "/workspace/image.png" }],
      ["read_visualization_file", { path: "/workspace/chart.html" }],
      ["read_marketplace_asset", { url: "https://example.com/image.png" }],
      ["read_local_marketplace_asset", { path: "/workspace/image.png" }],
      ["open_browser_window", { url: "https://example.com" }],
      ["close_quick_panel"],
      ["quick_panel_shortcut_read"],
      ["quick_panel_shortcut_update", { shortcut: "CmdOrCtrl+Alt+R" }],
    ]);
  });
});
