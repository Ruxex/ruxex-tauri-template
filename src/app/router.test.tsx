// @vitest-environment jsdom

import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { router } from "./router";

describe("router", () => {
  it("resolves the project list route", () => {
    const matches = matchRoutes(router.routes, "/projects");

    expect(matches?.at(-1)?.route.path).toBe("projects");
  });
});
