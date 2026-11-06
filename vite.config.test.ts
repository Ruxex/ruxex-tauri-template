import { describe, expect, it } from "vitest";

import viteConfig from "./vite.config";

describe("Vite development server", () => {
  it("does not watch Rust build artifacts", () => {
    const ignored = viteConfig.server?.watch?.ignored;

    expect(ignored).toContain("**/target/**");
  });
});
