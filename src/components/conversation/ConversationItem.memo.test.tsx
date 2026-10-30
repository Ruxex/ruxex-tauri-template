// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const markdownRender = vi.hoisted(() => vi.fn());

vi.mock("./MarkdownContent", () => ({
  MarkdownContent: ({ text }: { text: string }) => {
    markdownRender(text);
    return <div>{text}</div>;
  },
}));

import { ActivityItem } from "./ActivityItem";
import { ConversationItem } from "./ConversationItem";

describe("conversation timeline item rendering", () => {
  afterEach(() => {
    cleanup();
    markdownRender.mockReset();
  });

  it("does not rerender an unchanged message item", () => {
    const item = {
      id: "message-1",
      turnId: "turn-1",
      type: "agentMessage" as const,
      category: "message" as const,
      title: "Ruxex",
      text: "Stable reply",
    };
    const { rerender } = render(<ConversationItem item={item} />);

    rerender(<ConversationItem item={{ ...item }} />);

    expect(markdownRender).toHaveBeenCalledOnce();
  });

  it("does not rerender an unchanged activity item", () => {
    const item = {
      id: "activity-1",
      turnId: "turn-1",
      type: "plan",
      category: "activity" as const,
      title: "Plan",
      text: "Stable plan",
    };
    const { rerender } = render(<ActivityItem item={item} />);

    rerender(<ActivityItem item={{ ...item }} />);

    expect(markdownRender).toHaveBeenCalledOnce();
  });
});
