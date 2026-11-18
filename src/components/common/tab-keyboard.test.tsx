// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleTabListKeyDown } from "./tab-keyboard";

function TabList() {
  return (
    <div onKeyDown={handleTabListKeyDown} role="tablist">
      <button role="tab" type="button">
        First
      </button>
      <button role="tab" type="button">
        Second
      </button>
      <button role="tab" type="button">
        Third
      </button>
    </div>
  );
}

describe("handleTabListKeyDown", () => {
  afterEach(cleanup);

  it.each([
    ["ArrowRight", "First", "Second"],
    ["ArrowLeft", "First", "Third"],
    ["Home", "Third", "First"],
    ["End", "First", "Third"],
  ])("moves focus and activates the expected tab for %s", (key, from, to) => {
    const onClick = vi.fn();
    render(<TabList />);
    const tabs = screen.getAllByRole("tab");
    const current = screen.getByRole("tab", { name: from });
    const next = screen.getByRole("tab", { name: to });
    next.addEventListener("click", onClick);

    current.focus();
    const event = fireEvent.keyDown(current, { key });

    expect(event).toBe(false);
    expect(document.activeElement).toBe(next);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("ignores unrelated keys and targets outside the tab list", () => {
    const { container } = render(
      <>
        <TabList />
        <button type="button">Outside</button>
      </>,
    );
    const outside = screen.getByRole("button", { name: "Outside" });
    const first = screen.getByRole("tab", { name: "First" });
    first.focus();
    const ignoredKey = fireEvent.keyDown(first, { key: "Enter" });
    const activeAfterIgnoredKey = document.activeElement;
    outside.focus();
    const outsideKey = fireEvent.keyDown(outside, { key: "ArrowRight" });

    expect(ignoredKey).toBe(true);
    expect(outsideKey).toBe(true);
    expect(document.activeElement).toBe(outside);
    expect(activeAfterIgnoredKey).toBe(first);
    expect(container.querySelectorAll("[role='tab']")).toHaveLength(3);
  });
});
