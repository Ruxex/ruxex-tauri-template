// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ActivityItem } from "./ActivityItem";

describe("ActivityItem", () => {
  afterEach(cleanup);

  it("keeps diagnostic metadata visible in a collapsed activity", () => {
    render(
      <ActivityItem
        item={{
          id: "command-1",
          turnId: "turn-1",
          type: "commandExecution",
          category: "activity",
          title: "Command",
          text: "done",
          metadata: { command: "pnpm test", exitCode: "0" },
        }}
      />,
    );

    expect(screen.getByText("Command")).toBeTruthy();
    expect(screen.getByText("pnpm test")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("done")).toBeTruthy();
  });

  it("renders diff activity using the shared Markdown renderer", () => {
    render(
      <ActivityItem
        item={{
          id: "change-1",
          turnId: "turn-1",
          type: "fileChange",
          category: "activity",
          title: "Changes",
          text: "```diff\n+added\n-removed\n```",
        }}
      />,
    );

    expect(screen.getByTestId("diff-added").textContent).toContain("+added");
    expect(screen.getByTestId("diff-removed").textContent).toContain(
      "-removed",
    );
  });
});
