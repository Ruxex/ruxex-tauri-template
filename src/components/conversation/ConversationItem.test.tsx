// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConversationItem } from "./ConversationItem";

describe("ConversationItem", () => {
  afterEach(cleanup);

  it("renders user messages on the right with Markdown content", () => {
    render(
      <ConversationItem
        item={{
          id: "user-1",
          turnId: "turn-1",
          type: "userMessage",
          category: "message",
          title: "You",
          text: "**Inspect** `src`",
        }}
      />,
    );

    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Inspect").tagName).toBe("STRONG");
    expect(screen.getByText("src").tagName).toBe("CODE");
    expect(screen.getByRole("article").className).toContain("chat-end");
  });

  it("renders an empty streaming item with an explicit placeholder", () => {
    render(
      <ConversationItem
        item={{
          id: "agent-1",
          turnId: "turn-1",
          type: "agentMessage",
          category: "message",
          title: "Ruxex",
          text: "",
        }}
      />,
    );

    expect(screen.getByText("…")).toBeTruthy();
    expect(screen.getByRole("article").className).toContain("chat-start");
  });
});
