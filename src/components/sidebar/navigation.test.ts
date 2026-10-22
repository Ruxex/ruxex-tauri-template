import { describe, expect, it } from "vitest";

import { sidebarPanelForPath } from "./navigation";

describe("sidebarPanelForPath", () => {
  it.each([
    ["/", "home"],
    ["/projects", "projects"],
    ["/projects/p1", "projects"],
    ["/capabilities", "plugins"],
    ["/schedules", "automation"],
    ["/settings", "settings"],
    ["/settings/appearance", "settings"],
    ["/settings/account", "account"],
    ["/unknown", "home"],
  ] as const)("maps %s to %s", (pathname, panel) => {
    expect(sidebarPanelForPath(pathname)).toBe(panel);
  });
});
