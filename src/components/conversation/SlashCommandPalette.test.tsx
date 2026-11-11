// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { v2 } from "../../protocol";
import { SlashCommandPalette } from "./SlashCommandPalette";

vi.mock("../common/SkillIcon", () => ({
  SkillIcon: ({ skill }: { skill: v2.SkillMetadata }) => (
    <span data-testid={`skill-icon-${skill.name}`} />
  ),
}));

describe("SlashCommandPalette", () => {
  afterEach(cleanup);

  const skill: v2.SkillMetadata = {
    name: "review",
    description: "Review the current changes",
    path: "/workspace/.agents/skills/review",
    scope: "repo",
    enabled: true,
    pluginId: null,
  };

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

  it("focuses the palette and selects the highlighted command with arrow keys", async () => {
    const onSelect = vi.fn();
    render(<SlashCommandPalette disabled={false} onSelect={onSelect} />);

    const palette = screen.getByRole("menu", { name: "Slash commands" });
    await waitFor(() => expect(document.activeElement).toBe(palette));

    fireEvent.keyDown(palette, { key: "ArrowDown" });
    expect(
      screen.getByRole("menuitem", { name: "Compact" }).dataset.active,
    ).toBe("true");

    fireEvent.keyDown(palette, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("compact");
  });

  it("disables every command while the Composer is busy", () => {
    render(<SlashCommandPalette disabled onSelect={vi.fn()} />);

    for (const item of screen.getAllByRole("menuitem")) {
      expect((item as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("stacks commands and skills in separate vertical sections", () => {
    render(
      <SlashCommandPalette
        disabled={false}
        onSelect={vi.fn()}
        onSelectSkill={vi.fn()}
        skills={[skill]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Commands" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(
      screen
        .getByRole("menu", { name: "Slash commands" })
        .querySelector(".menu-vertical"),
    ).toBeTruthy();
  });

  it("filters commands and skills case-insensitively and reports skill selection", () => {
    const onSelect = vi.fn();
    const onSelectSkill = vi.fn();
    render(
      <SlashCommandPalette
        disabled={false}
        onSelect={onSelect}
        onSelectSkill={onSelectSkill}
        query="REV"
        skills={[skill]}
      />,
    );

    expect(screen.queryByRole("menuitem", { name: "Archive" })).toBeNull();
    const skillItem = screen.getByRole("menuitem", { name: /review/i });
    expect(skillItem.textContent).toContain("Review the current changes");
    fireEvent.click(skillItem);

    expect(onSelect).not.toHaveBeenCalled();
    expect(onSelectSkill).toHaveBeenCalledWith(skill);
  });

  it("renders the Skill interface icon alongside the candidate", () => {
    render(
      <SlashCommandPalette
        disabled={false}
        onSelect={vi.fn()}
        onSelectSkill={vi.fn()}
        skills={[
          {
            ...skill,
            interface: {
              iconSmall: "/home/user/.agents/skills/review/assets/icon.svg",
              iconSmallUrl: null,
              iconLargeUrl: null,
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId("skill-icon-review")).toBeTruthy();
  });

  it("shows skill loading, error, and empty states", () => {
    const { rerender } = render(
      <SlashCommandPalette disabled={false} onSelect={vi.fn()} skillsLoading />,
    );
    expect(screen.getByText("Loading skills…")).toBeTruthy();

    rerender(
      <SlashCommandPalette
        disabled={false}
        onSelect={vi.fn()}
        skillsError="Skills unavailable"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Skills unavailable",
    );

    rerender(
      <SlashCommandPalette disabled={false} onSelect={vi.fn()} skills={[]} />,
    );
    expect(screen.getByText("No skills available.")).toBeTruthy();
  });
});
