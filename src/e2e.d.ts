export {};

declare global {
  interface Window {
    __RUXEX_E2E__?: {
      captureScreenshot: (name: string) => Promise<void>;
      selectedWorkspaceFolder?: string;
    };
  }
}
