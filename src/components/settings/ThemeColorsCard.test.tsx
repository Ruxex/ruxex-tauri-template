// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeColorsCard } from "./ThemeColorsCard";

describe("ThemeColorsCard", () => {
  afterEach(cleanup);

  it("renders grouped color controls, shows the inherited preset, and reports edits", () => {
    const onColorChange = vi.fn();
    const onReset = vi.fn();

    render(
      <ThemeColorsCard
        colors={{ primary: "#123456" }}
        onReset={onReset}
        onColorChange={onColorChange}
        preset="system"
      />,
    );

    const details = screen
      .getByText("Advanced theme colors")
      .closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(
      (screen.getByLabelText("Primary color") as HTMLInputElement).value,
    ).toBe("#123456");
    expect(
      (screen.getByLabelText("Base 100 color") as HTMLInputElement).value,
    ).toBe("");
    expect(screen.getByText("Inherited from System")).toBeTruthy();
    expect(screen.getByText("Base colors")).toBeTruthy();
    expect(screen.getByText("Brand colors")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Primary color"), {
      target: { value: "oklch(60% 0.2 250)" },
    });

    expect(onColorChange).toHaveBeenCalledWith("primary", "oklch(60% 0.2 250)");

    fireEvent.click(
      screen.getByRole("button", { name: "Reset advanced colors" }),
    );
    expect(onReset).toHaveBeenCalledOnce();
  });
});
