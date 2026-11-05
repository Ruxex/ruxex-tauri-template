import assert from "node:assert/strict";

describe("Tauri diagnostics bridge", () => {
  it("executes a harmless frontend observation and emits a marker", async () => {
    const result = await browser.tauri.execute(() => {
      console.info("RUXEX_E2E_FRONTEND_MARKER");
      return {
        href: window.location.href,
        hasWdioApi: typeof window.wdioTauri !== "undefined",
        title: document.title,
      };
    });

    assert.equal(result.hasWdioApi, true);
    assert.match(result.href, /^(tauri|http):/);
    assert.equal(typeof result.title, "string");
  });
});
