import { describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const isNativeDesktopRuntime = vi.hoisted(() => true);

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@/app-server/runtime", () => ({ isNativeDesktopRuntime }));

describe("desktop Skill policy bridge", () => {
  it("loads the UI policy from the canonical Tauri command", async () => {
    invoke.mockResolvedValueOnce({
      hiddenSkills: ["imagegen"],
      defaultSkillRoots: ["/home/user/.ruxex_desktop/vendored/skills"],
      userSkillRoots: ["/home/user/.agents/skills"],
    });
    const { getDesktopUiPolicy } = await import("./skill-policy");

    await expect(getDesktopUiPolicy()).resolves.toEqual({
      hiddenSkills: ["imagegen"],
      defaultSkillRoots: ["/home/user/.ruxex_desktop/vendored/skills"],
      userSkillRoots: ["/home/user/.agents/skills"],
    });
    expect(invoke).toHaveBeenCalledWith("get_desktop_ui_policy");
  });
});
