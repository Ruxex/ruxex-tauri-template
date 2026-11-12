// @vitest-environment jsdom

import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { router } from "./router";

describe("router", () => {
  it("resolves the project list route", () => {
    const matches = matchRoutes(router.routes, "/projects");

    expect(matches?.at(-1)?.route.path).toBe("projects");
  });

  it("resolves the global MCP server settings route", () => {
    const matches = matchRoutes(router.routes, "/settings/mcp-servers");

    expect(matches?.at(-1)?.route.path).toBe("mcp-servers");
  });

  it("resolves the version settings route", () => {
    const matches = matchRoutes(router.routes, "/settings/version");

    expect(matches?.at(-1)?.route.path).toBe("version");
  });

  it("resolves the hooks settings route", () => {
    const matches = matchRoutes(router.routes, "/settings/hooks");

    expect(matches?.at(-1)?.route.path).toBe("hooks");
  });

  it("resolves plugin detail routes", () => {
    const matches = matchRoutes(
      router.routes,
      "/capabilities/plugins/community/example",
    );

    expect(matches?.at(-1)?.route.path).toBe(
      "capabilities/plugins/:marketplaceName/:pluginName",
    );
  });
});
