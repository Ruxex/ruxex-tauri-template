import { MockAppServer } from "../test-support/mock-app-server";

let server: MockAppServer | undefined;

export function getMockAppServer(): MockAppServer {
  if (server) {
    return server;
  }

  server = new MockAppServer();
  server.respond("model/list", { data: [], nextCursor: null });
  server.respond("project/list", { data: [], nextCursor: null } as never);
  server.respond("thread/list", {
    data: [],
    nextCursor: null,
    backwardsCursor: null,
  });
  server.respond("account/read", {
    providerId: "mock",
    account: null,
    accountId: null,
    displayName: null,
    authStatus: "unauthenticated",
    usage: null,
  } as never);

  return server;
}
