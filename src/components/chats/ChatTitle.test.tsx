// @vitest-environment jsdom

import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatTitle } from "./ChatTitle";

describe("ChatTitle", () => {
  let triggerResize: (() => void) | undefined;

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          triggerResize = () => callback([], this as unknown as ResizeObserver);
        }

        disconnect() {}

        observe() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    triggerResize = undefined;
  });

  it("slides an overflowing title only while hovered", () => {
    render(<ChatTitle isHovered title="A very long chat title" />);

    const titleText = screen.getByText("A very long chat title");
    const titleRegion = titleText.parentElement as HTMLElement;
    Object.defineProperty(titleRegion, "clientWidth", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(titleText, "scrollWidth", {
      configurable: true,
      value: 220,
    });
    act(() => triggerResize?.());

    expect(titleRegion.getAttribute("data-title-overflowing")).toBe("true");
    const marquee = titleRegion.querySelector<HTMLElement>(
      "[data-title-marquee]",
    );
    expect(marquee).toBeTruthy();
    expect(marquee?.style.transform).toBe("translateX(-120px)");
  });
});
