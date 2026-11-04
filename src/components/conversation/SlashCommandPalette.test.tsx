// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SlashCommandPalette } from "./SlashCommandPalette";

describe("SlashCommandPalette", () => {
  afterEach(cleanup);

  it("renders exactly the three supported commands", () => {
    render(<SlashCommandPalette disabled={false} onSelect={vi.fn()} />);

    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(screen.getByRole("menuitem", { name: "Archive" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Compact" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Goal" })).toBeTruthy();
  });

  it("reports the selected command ID", () => {
    const onSelect = vi.fn();
    render(<SlashCommandPalette disabled={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("menuitem", { name: "Compact" }));

    expect(onSelect).toHaveBeenCalledWith("compact");
  });

  it("disables every command while the Composer is busy", () => {
    render(<SlashCommandPalette disabled onSelect={vi.fn()} />);

    for (const item of screen.getAllByRole("menuitem")) {
      expect((item as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
