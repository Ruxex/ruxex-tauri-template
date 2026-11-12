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
        items={[
          message("user-1", "userMessage", "First prompt"),
          message("user-2", "userMessage", "Second prompt"),
          message("user-3", "userMessage", "Third prompt"),
          message("user-4", "userMessage", "Fourth prompt"),
          message("user-5", "userMessage", "Fifth prompt"),
        ]}
        timelineRef={{ current: timeline }}
      />,
    );

    const minimap = screen.getByRole("complementary", {
      name: "Conversation minimap",
    });
    expect(minimap.className).toContain("hidden");
    expect(minimap.className).toContain("chat-minimap-column");
    expect(minimap.className).toContain("min-[1360px]:flex");
    expect(minimap.className).toContain("justify-self-start");
    expect(minimap.className).toContain("sticky");
    expect(minimap.className).toContain("top-4");
    expect(minimap.className).toContain("h-[calc(100dvh-3rem)]");
    expect(minimap.className).toContain("max-h-[calc(100dvh-3rem)]");
    expect(minimap.className).toContain("overflow-y-auto");
    expect(minimap.className).not.toContain("fixed");
  });

  it("keeps the minimap column while hiding markers until five user messages are available", () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);
    const fourUserMessages = [
      message("user-1", "userMessage", "First prompt"),
      message("assistant-1", "agentMessage", "Assistant reply"),
      message("user-2", "userMessage", "Second prompt"),
      message("user-3", "userMessage", "Third prompt"),
      message("user-4", "userMessage", "Fourth prompt"),
    ];
    const { rerender } = render(
      <ConversationMinimap
        items={fourUserMessages}
        timelineRef={{ current: timeline }}
      />,
    );

    expect(
      screen.getByRole("complementary", { name: "Conversation minimap" }),
    ).toBeTruthy();
    expect(screen.queryByTestId("conversation-minimap-track")).toBeNull();

    rerender(
      <ConversationMinimap
        items={[
          ...fourUserMessages,
          message("user-5", "userMessage", "Fifth prompt"),
        ]}
        timelineRef={{ current: timeline }}
      />,
    );

    expect(
      screen.getByRole("complementary", { name: "Conversation minimap" }),
    ).toBeTruthy();
    expect(screen.getByTestId("conversation-minimap-track")).toBeTruthy();
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
          message("user-3", "userMessage", "Third prompt"),
          message("user-4", "userMessage", "Fourth prompt"),
          message("user-5", "userMessage", "Fifth prompt"),
        ]}
        timelineRef={{ current: timeline }}
      />,
    );

    expect(screen.getByTestId("conversation-minimap-track")).toBeTruthy();
    const markers = screen.getAllByRole("button", { name: /Jump to message/ });
    expect(markers).toHaveLength(5);
    expect(markers[0]?.className).toContain("h-7");
    expect(markers[0]?.className).toContain("w-10");
    expect(markers[0]?.className).toContain("-translate-x-[14px]");
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

  it("places markers at equal intervals regardless of message layout", async () => {
    const timeline = document.createElement("section");
    Object.defineProperty(timeline, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      top: 0,
    } as DOMRect);

    const items = [
      message("user-1", "userMessage", "First prompt"),
      message("user-2", "userMessage", "Second prompt"),
      message("user-3", "userMessage", "Third prompt"),
      message("user-4", "userMessage", "Fourth prompt"),
      message("user-5", "userMessage", "Fifth prompt"),
    ];
    for (const [index, item] of items.entries()) {
      const element = document.createElement("article");
      element.dataset.conversationItemId = item.id;
      vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
        top: [10, 150, 380, 620, 900][index],
        height: 40,
      } as DOMRect);
      timeline.append(element);
    }
    document.body.append(timeline);

    render(
      <ConversationMinimap items={items} timelineRef={{ current: timeline }} />,
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("conversation-minimap-marker-user-5").parentElement
          ?.parentElement?.parentElement?.style.top,
      ).toBe("calc(50% + 56px)"),
    );

    expect(
      items.map(
        (item) =>
          screen.getByTestId(`conversation-minimap-marker-${item.id}`)
            .parentElement?.parentElement?.parentElement?.style.top,
      ),
    ).toEqual([
      "calc(50% - 56px)",
      "calc(50% - 28px)",
      "calc(50% + 0px)",
      "calc(50% + 28px)",
      "calc(50% + 56px)",
    ]);
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
        items={[
          message("user-1", "userMessage", "Jump here"),
          message("user-2", "userMessage", "Second prompt"),
          message("user-3", "userMessage", "Third prompt"),
          message("user-4", "userMessage", "Fourth prompt"),
          message("user-5", "userMessage", "Fifth prompt"),
        ]}
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
    const initialItems = [
      message("user-1", "userMessage", "First prompt"),
      message("user-2", "userMessage", "Second prompt"),
      message("user-3", "userMessage", "Third prompt"),
      message("user-4", "userMessage", "Fourth prompt"),
      message("user-5", "userMessage", "Fifth prompt"),
    ];
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
          message("user-6", "userMessage", "New prompt"),
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

  it("enlarges the hovered marker and three neighbors on each side", () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);
    const items = [
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
    ].map((id) => message(`user-${id}`, "userMessage", `Prompt ${id}`));

    render(
      <ConversationMinimap items={items} timelineRef={{ current: timeline }} />,
    );

    const hoveredMarker = screen.getByRole("button", { name: /Prompt five/ });
    fireEvent.click(hoveredMarker);
    fireEvent.mouseEnter(hoveredMarker);

    expect(
      screen.getByTestId("conversation-minimap-marker-user-five").className,
    ).toEqual(expect.stringContaining("scale-200"));
    expect(
      screen.getByTestId("conversation-minimap-marker-user-five").className,
    ).toContain("translate-x-[14px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-four").className,
    ).toContain("scale-125");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-four").className,
    ).toContain("translate-x-[10px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-six").className,
    ).toContain("scale-125");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-six").className,
    ).toContain("translate-x-[10px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-three").className,
    ).toContain("scale-110");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-three").className,
    ).toContain("translate-x-[5px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-seven").className,
    ).toContain("scale-110");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-seven").className,
    ).toContain("translate-x-[5px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-two").className,
    ).toContain("translate-x-[2px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-eight").className,
    ).toContain("translate-x-[2px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-two").className,
    ).toContain("scale-105");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-eight").className,
    ).toContain("scale-105");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-one").className,
    ).not.toContain("translate-x-[2px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-one").className,
    ).not.toContain("translate-x-[5px]");
    expect(
      screen.getByTestId("conversation-minimap-marker-user-nine").className,
    ).not.toContain("translate-x-");
  });

  it("truncates long hover previews to the fixed character limit", () => {
    const timeline = document.createElement("section");
    document.body.append(timeline);
    const longPrompt = "A".repeat(100);

    render(
      <ConversationMinimap
        items={[
          message("user-long", "userMessage", longPrompt),
          message("user-2", "userMessage", "Second prompt"),
          message("user-3", "userMessage", "Third prompt"),
          message("user-4", "userMessage", "Fourth prompt"),
          message("user-5", "userMessage", "Fifth prompt"),
        ]}
        timelineRef={{ current: timeline }}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: /A{90}/ }));

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toHaveLength(96);
    expect(tooltip.textContent?.endsWith("...")).toBe(true);
  });
});
