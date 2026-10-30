// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    render(<ConversationItem item={item} onEdit={onEdit} />);

    expect(screen.queryByText("You")).toBeNull();
    expect(screen.getByText("Inspect").tagName).toBe("STRONG");
    expect(screen.getByText("src").tagName).toBe("CODE");
    expect(screen.getByRole("article").className).toContain("chat-end");

    const messageSurface = screen.getByText("Inspect").closest("p")
      ?.parentElement?.parentElement;
    expect(messageSurface?.className).toContain("rounded-box");
    expect(messageSurface?.className).not.toContain("chat-bubble");
    expect(messageSurface?.className).toContain("px-3");
    expect(messageSurface?.className).toContain("py-2");
    expect(
      screen.getByRole("group", { name: "Message actions" }).className,
    ).toContain("chat-footer");
    expect(screen.getByRole("button", { name: "Copy message" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    expect(
      (
        screen.getByRole("textbox", {
          name: "Edit message",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe(item.text);
  });

  it("copies a user message from the action row", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const item = {
      id: "user-1",
      turnId: "turn-1",
      type: "userMessage" as const,
      category: "message" as const,
      title: "You",
      text: "Copy this",
    };
    render(<ConversationItem item={item} onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Copy this"));
  });

  it("cancels inline editing without invoking the edit callback", () => {
    const onEdit = vi.fn();
    const item = {
      id: "user-1",
      turnId: "turn-1",
      type: "userMessage" as const,
      category: "message" as const,
      title: "You",
      text: "Original",
    };
    render(<ConversationItem item={item} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit message" }), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox", { name: "Edit message" })).toBeNull();
    expect(screen.getByText("Original")).toBeTruthy();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("submits the edited text from the inline form", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const item = {
      id: "user-1",
      turnId: "turn-1",
      type: "userMessage" as const,
      category: "message" as const,
      title: "You",
      text: "Original",
    };
    render(<ConversationItem item={item} onEdit={onEdit} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit message" }), {
      target: { value: "Edited" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(item, "Edited"));
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
