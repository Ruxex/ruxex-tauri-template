import {
  ArchiveBoxIcon,
  ArrowsPointingInIcon,
  FlagIcon,
} from "@heroicons/react/24/outline";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { v2 } from "../../protocol";
import { SkillIcon } from "../common/SkillIcon";
import { type SlashCommandId, slashCommands } from "./slash-command";

type SlashCommandPaletteProps = {
  commands?: readonly SlashCommandId[];
  disabled: boolean;
  query?: string;
  skills?: v2.SkillMetadata[];
  skillsLoading?: boolean;
  skillsError?: string | null;
  onSelect: (command: SlashCommandId) => void;
  onSelectSkill?: (skill: v2.SkillMetadata) => void;
  onDismiss?: () => void;
};

const commandIcons = {
  archive: ArchiveBoxIcon,
  compact: ArrowsPointingInIcon,
  goal: FlagIcon,
};

export function SlashCommandPalette({
  commands = slashCommands.map((command) => command.id),
  disabled,
  query = "",
  skills = [],
  skillsLoading = false,
  skillsError = null,
  onSelect,
  onSelectSkill,
  onDismiss,
}: SlashCommandPaletteProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCommands = slashCommands.filter(
    (command) =>
      commands.includes(command.id) &&
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
  const options: Array<
    | { kind: "command"; command: (typeof visibleCommands)[number] }
    | { kind: "skill"; skill: (typeof visibleSkills)[number] }
  > = [
    ...visibleCommands.map((command) => ({
      kind: "command" as const,
      command,
    })),
    ...visibleSkills.map((skill) => ({ kind: "skill" as const, skill })),
  ];
  const [activeIndex, setActiveIndex] = useState(0);
  const highlightedIndex = options.length
    ? Math.min(activeIndex, options.length - 1)
    : 0;
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (options.length === 0) {
      menuRef.current?.focus();
      return;
    }
    optionRefs.current[highlightedIndex]?.focus();
  }, [highlightedIndex, options.length]);

  function selectOption(index: number) {
    const option = options[index];
    if (disabled || !option) {
      return;
    }
    if (option.kind === "command") {
      onSelect(option.command.id);
    } else {
      onSelectSkill?.(option.skill);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onDismiss?.();
      return;
    }
    if (!options.length || disabled) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (current) => (current + direction + options.length) % options.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectOption(highlightedIndex);
    }
  }

  function optionProps(index: number) {
    const active = index === highlightedIndex;
    return {
      className: active
        ? "active bg-primary/20 font-semibold text-base-content"
        : undefined,
      "data-active": active ? "true" : undefined,
      onMouseEnter: () => setActiveIndex(index),
      ref: (element: HTMLButtonElement | null) => {
        optionRefs.current[index] = element;
      },
      tabIndex: -1,
    };
  }

  return (
    <div
      aria-label="Slash commands"
      className="mb-2 max-h-72 overflow-y-auto rounded-box border border-base-300 bg-base-200/60 p-2"
      onKeyDown={handleKeyDown}
      role="menu"
      ref={menuRef}
      tabIndex={-1}
    >
      <section aria-labelledby="slash-commands-heading">
        <h3
          className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60"
          id="slash-commands-heading"
        >
          Commands
        </h3>
        <ul className="menu menu-vertical w-full gap-1 p-0">
          {visibleCommands.map((command, index) => {
            const Icon = commandIcons[command.id];
            return (
              <li key={command.id}>
                <button
                  aria-label={command.label}
                  {...optionProps(index)}
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
            {visibleSkills.map((skill, skillIndex) => {
              const description =
                skill.interface?.shortDescription ||
                skill.shortDescription ||
                skill.description;
              const index = visibleCommands.length + skillIndex;
              return (
                <li key={skill.path}>
                  <button
                    aria-label={skill.name}
                    {...optionProps(index)}
                    disabled={disabled || !onSelectSkill}
                    onClick={() => onSelectSkill?.(skill)}
                    role="menuitem"
                    type="button"
                  >
                    <SkillIcon className="size-5" skill={skill} />
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
