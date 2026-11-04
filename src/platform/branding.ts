import { invoke } from "@tauri-apps/api/core";

export type Branding = {
  appName: string;
  assistantName: string;
  windowTitle: string;
};

let brandingRequest: Promise<Branding> | null = null;

export function getBranding(): Promise<Branding> {
  if (!brandingRequest) {
    brandingRequest = invoke<Branding>("get_branding").catch((error) => {
      brandingRequest = null;
      throw error;
    });
  }
  return brandingRequest;
}
