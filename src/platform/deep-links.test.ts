import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrent = vi.hoisted(() => vi.fn());
const onOpenUrl = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-deep-link", () => ({ getCurrent, onOpenUrl }));

describe("deep-link adapter", () => {
  beforeEach(() => {
    getCurrent.mockReset();
    onOpenUrl.mockReset();
  });

  it("routes only valid Ruxex links and deduplicates startup/current events", async () => {
    let callback: ((urls: string[]) => void) | undefined;
    const unlisten = vi.fn();
    getCurrent.mockResolvedValue([
      "ruxex://thread/thread-1",
      "https://evil.test",
    ]);
    onOpenUrl.mockImplementation(async (next: (urls: string[]) => void) => {
      callback = next;
      return unlisten;
    });
    const { startDeepLinkListener } = await import("./deep-links");
    const targets: string[] = [];

    const stop = await startDeepLinkListener((target) => {
      targets.push(`${target.kind}:${target.id}`);
    });
    callback?.(["ruxex://thread/thread-1", "ruxex://project/project-1"]);

    expect(targets).toEqual(["thread:thread-1", "project:project-1"]);
    stop();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
