import { invoke } from "@tauri-apps/api/core";

export function readImageFile(path: string): Promise<string> {
  return invoke<string>("read_image_file", { path });
}

export function openBrowserWindow(url: string): Promise<void> {
  return invoke("open_browser_window", { url });
}
