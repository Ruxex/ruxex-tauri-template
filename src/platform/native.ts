import { invoke } from "@tauri-apps/api/core";

export type QuickPanelShortcutSettings = {
  shortcut: string;
  defaultShortcut: string;
};

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
