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
    expect(marquee?.style.transitionDelay).toBe("400ms");
    expect(marquee?.style.transitionDuration).toBe("4500ms");
  });

  it("keeps a constant scroll speed as the overflow distance changes", () => {
    render(<ChatTitle isHovered title="A title that slightly overflows" />);

    const titleText = screen.getByText("A title that slightly overflows");
    const titleRegion = titleText.parentElement as HTMLElement;
    Object.defineProperty(titleRegion, "clientWidth", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(titleText, "scrollWidth", {
      configurable: true,
      value: 140,
    });
    act(() => triggerResize?.());

    const marquee = titleRegion.querySelector<HTMLElement>(
      "[data-title-marquee]",
    );
    expect(marquee?.style.transform).toBe("translateX(-40px)");
    expect(marquee?.style.transitionDuration).toBe("1500ms");
  });

  it("does not animate when the title only barely overflows", () => {
    render(<ChatTitle isHovered title="A title with tiny overflow" />);

    const titleText = screen.getByText("A title with tiny overflow");
    const titleRegion = titleText.parentElement as HTMLElement;
    Object.defineProperty(titleRegion, "clientWidth", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(titleText, "scrollWidth", {
      configurable: true,
      value: 108,
    });
    act(() => triggerResize?.());

    expect(titleRegion.getAttribute("data-title-overflowing")).toBe("false");
    expect(titleRegion.querySelector("[data-title-marquee]")).toBeNull();
  });
});
