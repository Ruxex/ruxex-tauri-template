import type { v2 } from "../../protocol";

export const slashCommands = [
  { id: "archive", label: "Archive" },
  { id: "compact", label: "Compact" },
  { id: "goal", label: "Goal" },
] as const;

export type SlashCommandId = (typeof slashCommands)[number]["id"];

export type SlashCommandInput = {
  query: string;
};

export type SlashCommandSelection =
  | { kind: "immediate"; command: Exclude<SlashCommandId, "goal"> }
  | { kind: "goal"; message: string };

export function getSlashCommandInput(
  message: string,
): SlashCommandInput | null {
  if (!message.startsWith("/")) {
    return null;
  }

  return { query: message.slice(1).split(/\s/, 1)[0] ?? "" };
}

export function selectSlashCommand(
  message: string,
  command: SlashCommandId,
): SlashCommandSelection {
  if (command !== "goal") {
    return { kind: "immediate", command };
  }

  const commandEnd = message.slice(1).search(/\s/);
  const goalMessage =
    commandEnd === -1 ? "" : message.slice(commandEnd + 1).trimStart();

  return { kind: "goal", message: goalMessage };
}

export function selectSlashSkill(
  message: string,
  skill: Pick<v2.SkillMetadata, "name" | "path">,
): { message: string; skill: Pick<v2.SkillMetadata, "name" | "path"> } {
  const commandEnd = message.slice(1).search(/\s/);
  const skillMessage =
    commandEnd === -1 ? "" : message.slice(commandEnd + 1).trimStart();

  return { message: skillMessage, skill };
}
