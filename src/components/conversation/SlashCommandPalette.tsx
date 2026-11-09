import {
  ArchiveBoxIcon,
  ArrowsPointingInIcon,
  FlagIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import type { v2 } from "../../protocol";
import { type SlashCommandId, slashCommands } from "./slash-command";

type SlashCommandPaletteProps = {
  disabled: boolean;
  query?: string;
  skills?: v2.SkillMetadata[];
  skillsLoading?: boolean;
  skillsError?: string | null;
  onSelect: (command: SlashCommandId) => void;
  onSelectSkill?: (skill: v2.SkillMetadata) => void;
};

const commandIcons = {
  archive: ArchiveBoxIcon,
  compact: ArrowsPointingInIcon,
  goal: FlagIcon,
};

export function SlashCommandPalette({
  disabled,
  query = "",
  skills = [],
  skillsLoading = false,
  skillsError = null,
  onSelect,
  onSelectSkill,
}: SlashCommandPaletteProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCommands = slashCommands.filter((command) =>
    `${command.id} ${command.label}`.toLowerCase().includes(normalizedQuery),
  );
  const visibleSkills = skills.filter((skill) =>
    [
      skill.name,
      skill.description,
      skill.shortDescription,
      skill.interface?.shortDescription,
      skill.path,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );

  return (
    <div
      aria-label="Slash commands"
      className="mb-2 max-h-72 overflow-y-auto rounded-box border border-base-300 bg-base-200/60 p-2"
      role="menu"
    >
      <section aria-labelledby="slash-commands-heading">
        <h3
          className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60"
          id="slash-commands-heading"
        >
          Commands
        </h3>
        <ul className="menu menu-vertical w-full gap-1 p-0">
          {visibleCommands.map((command) => {
            const Icon = commandIcons[command.id];
            return (
              <li key={command.id}>
                <button
                  aria-label={command.label}
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
          {!visibleCommands.length && (
            <li className="px-2 py-2 text-xs text-base-content/60">
              No matching commands.
            </li>
          )}
        </ul>
      </section>
      <section aria-labelledby="slash-skills-heading" className="mt-2">
        <h3
          className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60"
          id="slash-skills-heading"
        >
          Skills
        </h3>
        {skillsLoading && (
          <p className="px-2 py-2 text-xs text-base-content/60" role="status">
            Loading skills…
          </p>
        )}
        {!skillsLoading && skillsError && (
          <p className="px-2 py-2 text-xs text-error" role="alert">
            {skillsError}
          </p>
        )}
        {!skillsLoading && !skillsError && !skills.length && (
          <p className="px-2 py-2 text-xs text-base-content/60">
            No skills available.
          </p>
        )}
        {!skillsLoading && !skillsError && skills.length > 0 && (
          <ul className="menu menu-vertical w-full gap-1 p-0">
            {visibleSkills.map((skill) => {
              const description =
                skill.interface?.shortDescription ||
                skill.shortDescription ||
                skill.description;
              return (
                <li key={skill.path}>
                  <button
                    aria-label={skill.name}
                    disabled={disabled || !onSelectSkill}
                    onClick={() => onSelectSkill?.(skill)}
                    role="menuitem"
                    type="button"
                  >
                    <SparklesIcon aria-hidden="true" className="size-4" />
                    <span className="min-w-0 text-left">
                      <span className="block truncate font-medium">
                        {skill.name}
                      </span>
                      <span className="block truncate text-xs font-normal text-base-content/65">
                        {description}
                      </span>
                      <span className="block truncate text-[11px] font-normal text-base-content/50">
                        {skill.scope} · {skill.path}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!visibleSkills.length && (
              <li className="px-2 py-2 text-xs text-base-content/60">
                No matching skills.
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
