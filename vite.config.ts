import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    setupFiles: ["./src/test-setup.ts"],
    exclude: [
      "e2e/**",
      "fixtures/dummy-home/**/*.spec.ts",
      "fixtures/marketplace-home/**/*.spec.ts",
      "artifact-tool/**",
      "**/node_modules/**",
    ],
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/target/**"],
    },
  },
});
