// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeColorsCard } from "./ThemeColorsCard";

describe("ThemeColorsCard", () => {
  afterEach(cleanup);

  it("renders DaisyUI color controls and reports edits", () => {
    const onColorChange = vi.fn();

    render(
      <ThemeColorsCard
        colors={{ primary: "#123456" }}
        onColorChange={onColorChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Theme colors" })).toBeTruthy();
    expect(
      (screen.getByLabelText("Primary color") as HTMLInputElement).value,
    ).toBe("#123456");
    expect(
      (screen.getByLabelText("Base 100 color") as HTMLInputElement).value,
    ).toBe("");

    fireEvent.change(screen.getByLabelText("Primary color"), {
      target: { value: "oklch(60% 0.2 250)" },
    });

    expect(onColorChange).toHaveBeenCalledWith("primary", "oklch(60% 0.2 250)");
  });
});
