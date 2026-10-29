// @vitest-environment jsdom

import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { router } from "./router";

describe("router", () => {
  it("resolves the new project page before the project detail route", () => {
    const matches = matchRoutes(router.routes, "/projects/new");

    expect(matches?.at(-1)?.route.path).toBe("projects/new");
  });
});
