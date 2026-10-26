import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

describe("daemon API", () => {
  beforeEach(() => {
    invoke.mockReset().mockResolvedValue({ status: "running" });
  });

  it("invokes the Tauri daemon command with the lifecycle action", async () => {
    const { controlAppServerDaemon } = await import("./daemon-api");

    await controlAppServerDaemon("restart");

    expect(invoke).toHaveBeenCalledWith("app_server_daemon_control", {
      action: "restart",
    });
  });
});
