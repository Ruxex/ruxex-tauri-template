// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConversationItem } from "./ConversationItem";

describe("ConversationItem", () => {
  afterEach(cleanup);

  it("renders user messages on the right with Markdown content", () => {
    const onEdit = vi.fn();
    const item = {
      id: "user-1",
      turnId: "turn-1",
      type: "userMessage" as const,
      category: "message" as const,
      title: "You",
      text: "**Inspect** `src`",
    };
    render(
      <ConversationItem item={item} onEdit={onEdit} />,
    );

    expect(screen.queryByText("You")).toBeNull();
    expect(screen.getByText("Inspect").tagName).toBe("STRONG");
    expect(screen.getByText("src").tagName).toBe("CODE");
    expect(screen.getByRole("article").className).toContain("chat-end");

    const messageSurface = screen.getByText("Inspect").closest("p")
      ?.parentElement?.parentElement;
    expect(messageSurface?.className).toContain("rounded-box");
    expect(messageSurface?.className).not.toContain("chat-bubble");
    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    expect(onEdit).toHaveBeenCalledWith(item);
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
    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
  });

  it("does not offer editing for non-text user inputs", () => {
    render(
      <ConversationItem
        item={{
          id: "user-image-1",
          turnId: "turn-1",
          type: "userMessage",
          category: "message",
          title: "You",
          text: "",
          editable: false,
        }}
        onEdit={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
  });
});
