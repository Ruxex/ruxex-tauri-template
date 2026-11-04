import {
  ArchiveBoxIcon,
  ArrowsPointingInIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";

import { type SlashCommandId, slashCommands } from "./slash-command";

type SlashCommandPaletteProps = {
  disabled: boolean;
  onSelect: (command: SlashCommandId) => void;
};

const commandIcons = {
  archive: ArchiveBoxIcon,
  compact: ArrowsPointingInIcon,
  goal: FlagIcon,
};

export function SlashCommandPalette({
  disabled,
  onSelect,
}: SlashCommandPaletteProps) {
  return (
    <div
      aria-label="Slash commands"
      className="mb-2 rounded-box border border-base-300 bg-base-200/60 p-1"
      role="menu"
    >
      <ul className="menu menu-horizontal w-full gap-1 p-0">
        {slashCommands.map((command) => {
          const Icon = commandIcons[command.id];
          return (
            <li className="flex-1" key={command.id}>
              <button
                disabled={disabled}
                onClick={() => onSelect(command.id)}
                role="menuitem"
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {command.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
