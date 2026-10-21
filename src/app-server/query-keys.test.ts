import { describe, expect, it } from "vitest";

import { appServerQueryKeys } from "./query-keys";

describe("app-server query keys", () => {
  it("keeps resource identity in thread-scoped keys", () => {
    expect(appServerQueryKeys.thread("thread-1")).not.toEqual(
      appServerQueryKeys.thread("thread-2"),
    );
    expect(
      appServerQueryKeys.threadTurns("thread-1", { limit: 10 }),
    ).not.toEqual(appServerQueryKeys.threadItems("thread-1", { limit: 10 }));
  });

  it("keeps list and search parameters in their keys", () => {
    expect(appServerQueryKeys.threadList({ limit: 10 })).not.toEqual(
      appServerQueryKeys.threadList({ limit: 20 }),
    );
    expect(appServerQueryKeys.threadSearch({ searchTerm: "one" })).not.toEqual(
      appServerQueryKeys.threadSearch({ searchTerm: "two" }),
    );
  });

  it("separates account refresh variants", () => {
    expect(appServerQueryKeys.accountRead(false)).not.toEqual(
      appServerQueryKeys.accountRead(true),
    );
    expect(appServerQueryKeys.account).toEqual(["app-server", "account"]);
  });

  it("keeps conversation subresources under the selected thread", () => {
    const threadId = "thread-1";
    const params = { limit: 10 };
    const keys = [
      appServerQueryKeys.threadGoal(threadId),
      appServerQueryKeys.threadAttachments(threadId, params),
      appServerQueryKeys.threadQueue(threadId, params),
      appServerQueryKeys.threadConversation(threadId, params),
    ];

    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(
      keys.length,
    );
    expect(keys.every((key) => key.includes(threadId))).toBe(true);
  });
});
