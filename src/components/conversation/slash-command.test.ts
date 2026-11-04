import { describe, expect, it } from "vitest";

import {
  getSlashCommandInput,
  selectSlashCommand,
  slashCommands,
} from "./slash-command";

describe("slash commands", () => {
  it("exposes the archive, compact, and goal commands", () => {
    expect(slashCommands.map((command) => command.id)).toEqual([
      "archive",
      "compact",
      "goal",
    ]);
  });

  it("only activates when the first character is a slash", () => {
    expect(getSlashCommandInput("Ship it")).toBeNull();
    expect(getSlashCommandInput(" /goal")).toBeNull();
    expect(getSlashCommandInput("/")).toEqual({ query: "" });
    expect(getSlashCommandInput("/go")).toEqual({ query: "go" });
  });

  it("keeps text after a selected goal command", () => {
    expect(selectSlashCommand("/goal Ship the redesign", "goal")).toEqual({
      kind: "goal",
      message: "Ship the redesign",
    });
    expect(selectSlashCommand("/g", "goal")).toEqual({
      kind: "goal",
      message: "",
    });
  });

  it("returns archive and compact as immediate actions", () => {
    expect(selectSlashCommand("/archive", "archive")).toEqual({
      kind: "immediate",
      command: "archive",
    });
    expect(selectSlashCommand("/c", "compact")).toEqual({
      kind: "immediate",
      command: "compact",
    });
  });
});
