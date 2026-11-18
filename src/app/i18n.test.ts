import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as localization from "./i18n";

describe("UI language", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["en", "ja-JP", "en"],
    ["ja", "en-US", "ja"],
    ["system", "ja-JP", "ja"],
    ["system", "JA-jp", "ja"],
    ["system", "en-US", "en"],
    ["system", "fr-FR", "en"],
    ["system", "", "en"],
  ] as const)("resolves %s with system %s to %s", (language, system, expected) => {
    expect(localization.resolveUiLanguage).toBeTypeOf("function");
    expect(localization.resolveUiLanguage(language, system)).toBe(expected);
  });

  it("uses the browser language for system formatting", () => {
    vi.stubGlobal("navigator", { language: "ja-JP" });
    expect(localization.uiLocale).toBeTypeOf("function");
    expect(localization.uiLocale("system")).toBe("ja");
    expect(localization.uiLocale("en")).toBe("en");
  });

  it("falls back to English outside a browser", () => {
    vi.stubGlobal("navigator", undefined);
    expect(localization.resolveUiLanguage).toBeTypeOf("function");
    expect(localization.resolveUiLanguage("system")).toBe("en");
  });
});

describe("localization runtime", () => {
  it("is initialized with English messages before rendering", () => {
    expect(localization.i18n).toBeDefined();
    expect(localization.i18n.isInitialized).toBe(true);
    expect(localization.i18n.resolvedLanguage).toBe("en");
    expect(localization.i18n.t("actions.cancel", { ns: "common" })).toBe("Cancel");
  });

  it("selects Japanese and falls back to English for an unsupported locale", async () => {
    expect(localization.i18n).toBeDefined();
    try {
      await localization.i18n.changeLanguage("ja");
      expect(localization.i18n.t("actions.cancel", { ns: "common" })).toBe("キャンセル");
      await localization.i18n.changeLanguage("fr");
      expect(localization.i18n.t("actions.cancel", { ns: "common" })).toBe("Cancel");
    } finally {
      await localization.i18n.changeLanguage("en");
    }
  });

  it("preserves the existing language-explicit translation adapter", () => {
    expect(localization.translateUi("quickPanelWaylandUnavailable", "ja")).toBe(
      "Linux / Waylandではグローバルショートカットは現在利用できません。",
    );
  });
});

describe("catalog validation", () => {
  const checker = join(process.cwd(), "scripts/check-i18n-catalogs.mjs");

  function checkFixture(english: unknown, japanese: unknown, extraNamespace = false) {
    const root = mkdtempSync(join(tmpdir(), "ruxex-i18n-"));
    try {
      for (const locale of ["en", "ja"]) mkdirSync(join(root, locale));
      writeFileSync(join(root, "en/common.json"), JSON.stringify(english));
      writeFileSync(join(root, "ja/common.json"), JSON.stringify(japanese));
      if (extraNamespace) writeFileSync(join(root, "ja/extra.json"), '{"title":"追加"}');
      return spawnSync(process.execPath, [checker, root], { encoding: "utf8" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("validates every namespace in the application catalogs", () => {
    const result = spawnSync(process.execPath, [checker], { encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("accepts complete nested messages", () => {
    const result = checkFixture({ actions: { cancel: "Cancel" } }, { actions: { cancel: "キャンセル" } });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it.each([
    [{ actions: { cancel: "Cancel" } }, {}, "missing key: actions.cancel"],
    [{}, { actions: { cancel: "キャンセル" } }, "extra key: actions.cancel"],
    [{ actions: { cancel: "Cancel" } }, { actions: { cancel: "  " } }, "empty message: actions.cancel"],
    [{ actions: { cancel: "Cancel" } }, { actions: { cancel: null } }, "invalid message: actions.cancel"],
  ])("rejects catalog drift or unusable messages (%s / %s)", (en, ja, diagnostic) => {
    const result = checkFixture(en, ja);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(diagnostic);
  });

  it("rejects translations that drop named interpolation values", () => {
    const result = checkFixture({ selected: "Selected: {{name}}" }, { selected: "選択済み" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("interpolation mismatch: selected");
  });

  it("rejects extra Japanese namespaces", () => {
    const result = checkFixture({ title: "Title" }, { title: "タイトル" }, true);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("extra namespace: extra");
  });
});
