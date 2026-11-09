import { invoke } from "@tauri-apps/api/core";

export type QuickPanelShortcutSettings = {
  shortcut: string;
  defaultShortcut: string;
};

export type ArtifactPreviewData = {
  mimeType: "image/svg+xml";
  dataUrl: string;
  format: "xlsx" | "docx" | "pptx" | "pdf";
  sheets: number;
  rows: number;
  columns: number;
  byteSize: number;
  pages: ArtifactPreviewPage[];
  diagnostics: string[];
};

export type ArtifactPreviewPage = {
  label: string;
  dataUrl: string;
  width: number;
  height: number;
  diagnostics: string[];
};

export function previewArtifact(path: string): Promise<ArtifactPreviewData> {
  return invoke<ArtifactPreviewData>("preview_artifact", { path });
}

export function openArtifact(path: string): Promise<void> {
  return invoke("open_artifact", { path });
}

export function saveArtifact(path: string, destination: string): Promise<string> {
  return invoke<string>("save_artifact", { path, destination });
}

export function readImageFile(path: string): Promise<string> {
  return invoke<string>("read_image_file", { path });
}

export function readMarketplaceAsset(url: string): Promise<string> {
  return invoke<string>("read_marketplace_asset", { url });
}

export function readLocalMarketplaceAsset(path: string): Promise<string> {
  return invoke<string>("read_local_marketplace_asset", { path });
}

export function openBrowserWindow(url: string): Promise<void> {
  return invoke("open_browser_window", { url });
}

export function closeQuickPanel(): Promise<void> {
  return invoke("close_quick_panel");
}

export function readQuickPanelShortcut(): Promise<QuickPanelShortcutSettings> {
  return invoke<QuickPanelShortcutSettings>("quick_panel_shortcut_read");
}

export function updateQuickPanelShortcut(
  shortcut: string,
): Promise<QuickPanelShortcutSettings> {
  return invoke<QuickPanelShortcutSettings>("quick_panel_shortcut_update", {
    shortcut,
  });
}
