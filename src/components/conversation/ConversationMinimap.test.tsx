// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationMinimap } from "./ConversationMinimap";
import type { ConversationViewItem } from "./conversation-model";

function message(
  id: string,
  type: ConversationViewItem["type"],
  text: string,
): ConversationViewItem {
  return {
    id,
    turnId: `turn-${id}`,
    type,
    category: "message",
    title: type === "userMessage" ? "You" : "Assistant",
    text,
  };
}

describe("ConversationMinimap", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("keeps the minimap hidden until the layout has room beside the sidebar", () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);

    render(
      <ConversationMinimap
        items={[message("user-1", "userMessage", "First prompt")]}
        timelineRef={{ current: timeline }}
      />,
    );

    const minimap = screen.getByRole("complementary", {
      name: "Conversation minimap",
    });
    expect(minimap.className).toContain("hidden");
    expect(minimap.className).toContain("min-[1760px]:flex");
  });

  it("shows dense user-message markers and previews only on hover", () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);

    render(
      <ConversationMinimap
        items={[
          message("user-1", "userMessage", "First prompt"),
          message("assistant-1", "agentMessage", "Assistant reply"),
          message("user-2", "userMessage", "Second prompt"),
        ]}
        timelineRef={{ current: timeline }}
      />,
    );

    expect(screen.getByTestId("conversation-minimap-track")).toBeTruthy();
    const markers = screen.getAllByRole("button", { name: /Jump to message/ });
    expect(markers).toHaveLength(2);
    expect(markers[0]?.className).toContain("size-7");
    expect(screen.queryByRole("tooltip")).toBeNull();

    const firstMarker = screen.getByRole("button", { name: /First prompt/ });
    fireEvent.click(firstMarker);
    fireEvent.mouseEnter(firstMarker);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toBe("First prompt");
    expect(tooltip.className).toContain("left-10");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-1").className,
    ).toEqual(expect.stringContaining("scale-200"));
    expect(
      screen.getByTestId("conversation-minimap-marker-user-1").className,
    ).toContain("translate-x-[14px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-1").className,
    ).toContain("duration-200");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-2").className,
    ).toContain("scale-125");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-2").className,
    ).not.toContain("border-primary");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-2").className,
    ).not.toContain("bg-primary");
  });

  it("scrolls the matching conversation item when a marker is clicked", () => {
    const timeline = document.createElement("section");
    const target = document.createElement("article");
    target.dataset.conversationItemId = "user-1";
    target.scrollIntoView = vi.fn();
    timeline.append(target);
    document.body.append(timeline);

    render(
      <ConversationMinimap
        items={[message("user-1", "userMessage", "Jump here")]}
        timelineRef={{ current: timeline }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Jump here/ }));

    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("selects the newest user message when a new message is added", async () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);
    const initialItems = [message("user-1", "userMessage", "First prompt")];
    const { rerender } = render(
      <ConversationMinimap
        items={initialItems}
        timelineRef={{ current: timeline }}
      />,
    );

    rerender(
      <ConversationMinimap
        items={[
          ...initialItems,
          message("user-2", "userMessage", "New prompt"),
        ]}
        timelineRef={{ current: timeline }}
      />,
    );

    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /New prompt/ })
          .getAttribute("aria-current"),
      ).toBe("location"),
    );
  });

  it("enlarges the hovered marker and two neighbors on each side", () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);
    const items = ["one", "two", "three", "four", "five"].map((id) =>
      message(`user-${id}`, "userMessage", `Prompt ${id}`),
    );

    render(
      <ConversationMinimap items={items} timelineRef={{ current: timeline }} />,
    );

    const hoveredMarker = screen.getByRole("button", { name: /Prompt three/ });
    fireEvent.click(hoveredMarker);
    fireEvent.mouseEnter(hoveredMarker);

    expect(
      screen.getByTestId("conversation-minimap-marker-user-three").className,
    ).toEqual(expect.stringContaining("scale-200"));
    expect(
      screen.getByTestId("conversation-minimap-marker-user-three").className,
    ).toContain("translate-x-[14px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-two").className,
    ).toContain("scale-125");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-two").className,
    ).toContain("translate-x-[8px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-four").className,
    ).toContain("scale-125");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-four").className,
    ).toContain("translate-x-[8px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-one").className,
    ).toContain("scale-110");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-one").className,
    ).toContain("translate-x-[3px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-five").className,
    ).toContain("scale-110");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-five").className,
    ).toContain("translate-x-[3px]");
  });

  it("truncates long hover previews to the fixed character limit", () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);
    const longPrompt = "A".repeat(100);

    render(
      <ConversationMinimap
        items={[message("user-long", "userMessage", longPrompt)]}
        timelineRef={{ current: timeline }}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: /A{90}/ }));

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toHaveLength(96);
    expect(tooltip.textContent?.endsWith("...")).toBe(true);
  });
});
