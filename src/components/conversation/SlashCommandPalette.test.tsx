// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { v2 } from "../../protocol";
import {
  SlashCommandPalette,
  type SlashCommandPaletteHandle,
} from "./SlashCommandPalette";

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

    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByRole("option", { name: "Archive" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Compact" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Goal" })).toBeTruthy();
  });

  it("reports the selected command ID", () => {
    const onSelect = vi.fn();
    render(<SlashCommandPalette disabled={false} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("option", { name: "Compact" }));

    expect(onSelect).toHaveBeenCalledWith("compact");
  });

  it("moves the active option and selects it with keyboard keys", () => {
    const onSelect = vi.fn();
    const ref = createRef<SlashCommandPaletteHandle>();
    render(
      <SlashCommandPalette
        disabled={false}
        onSelect={onSelect}
        ref={ref}
      />,
    );

    const archive = screen.getByRole("option", { name: "Archive" });
    expect(archive.dataset.active).toBe("true");

    act(() =>
      ref.current?.handleKeyDown({ key: "ArrowDown", preventDefault: vi.fn() }),
    );
    const compact = screen.getByRole("option", { name: "Compact" });
    expect(compact.dataset.active).toBe("true");

    act(() =>
      ref.current?.handleKeyDown({ key: "Enter", preventDefault: vi.fn() }),
    );
    expect(onSelect).toHaveBeenCalledWith("compact");
  });

  it("disables every command while the Composer is busy", () => {
    render(<SlashCommandPalette disabled onSelect={vi.fn()} />);

    for (const item of screen.getAllByRole("option")) {
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

    expect(screen.getByRole("group", { name: "Commands" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Skills" })).toBeTruthy();
    expect(
      screen
        .getByRole("listbox", { name: "Slash commands" })
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

    expect(screen.queryByRole("option", { name: "Archive" })).toBeNull();
    const skillItem = screen.getByRole("option", { name: /review/i });
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
