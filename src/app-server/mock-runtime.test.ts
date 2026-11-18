import { beforeEach, describe, expect, it, vi } from "vitest";

describe("getMockAppServer", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates one mock server with the default App Server responses", async () => {
    const { getMockAppServer } = await import("./mock-runtime");
    const server = getMockAppServer();

    expect(getMockAppServer()).toBe(server);
    await expect(server.request("model/list", {} as never)).resolves.toMatchObject({
      response: { data: [], nextCursor: null },
    });
    await expect(server.request("project/list", {} as never)).resolves.toMatchObject({
      response: { data: [], nextCursor: null },
    });
    await expect(server.request("thread/list", {} as never)).resolves.toMatchObject({
      response: { data: [], nextCursor: null, backwardsCursor: null },
    });
    await expect(server.request("account/read", {} as never)).resolves.toMatchObject({
      response: {
        providerId: "mock",
        authStatus: "unauthenticated",
        account: null,
      },
    });
  });
});
