import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AppProviders } from "./app/providers";
import { router } from "./app/router";
import { invoke } from "@tauri-apps/api/core";
import "./styles/index.css";

if (import.meta.env.VITE_E2E === "1") {
  window.__RUXEX_E2E__ = {
    captureScreenshot: (name) =>
      invoke<void>("capture_ui_fixture_screenshot", { name }),
  };
}

if (import.meta.env.VITE_E2E_PLUGIN === "1") {
  await import("@wdio/tauri-plugin");
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("The application root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <AppProviders router={router} />
  </StrictMode>,
);
