export const isMockAppServerRuntime =
  import.meta.env.VITE_MOCK_APP_SERVER === "1";

export const isDesktopRuntime =
  isMockAppServerRuntime ||
  (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);

export const isNativeDesktopRuntime =
  !isMockAppServerRuntime &&
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;
