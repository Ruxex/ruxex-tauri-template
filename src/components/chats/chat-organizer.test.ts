import { describe, expect, it } from "vitest";

import { organizeChats } from "./chat-organizer";

function chat(
  id: string,
  overrides: Partial<Parameters<typeof organizeChats>[0][number]> = {},
) {
  return {
    id,
    name: id,
    preview: id,
    status: { type: "idle" as const },
    updatedAt: 10,
    ...overrides,
  };
}

describe("organizeChats", () => {
  it("groups pinned, active, recent, and archived chats without provider data", () => {
    const result = organizeChats([
      chat("pinned", { pinned: true }),
      chat("running", {
        liveStatus: "running",
        updatedAt: 20,
      }),
      chat("recent", { updatedAt: 15 }),
      chat("archived", { archived: true }),
    ]);

    expect(result.pinned.map((item) => item.id)).toEqual(["pinned"]);
    expect(result.active.map((item) => item.id)).toEqual(["running"]);
    expect(result.recent.map((item) => item.id)).toEqual(["recent"]);
    expect(result.archived.map((item) => item.id)).toEqual(["archived"]);
    expect(JSON.stringify(result)).not.toContain("model");
  });

  it("uses the chat status selector for approval and user-input waiting", () => {
    const result = organizeChats([
      chat("waiting", {
        status: { type: "active", activeFlags: ["waitingOnApproval"] },
      }),
    ]);

    expect(result.active.map((item) => item.id)).toEqual(["waiting"]);
  });
});
