import { useTranslation } from "react-i18next";
import { ArchiveBoxIcon, ArrowsPointingInIcon, FlagIcon } from "@heroicons/react/24/outline";
import { type KeyboardEvent, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { v2 } from "@/protocol";
import { SkillIcon } from "@/components/base/common/SkillIcon";
import { type SlashCommandId, slashCommands } from "./slash-command";

type SlashCommandPaletteProps = {
  commands?: readonly SlashCommandId[];
  disabled: boolean;
  id?: string;
  query?: string;
  skills?: v2.SkillMetadata[];
  skillsLoading?: boolean;
  skillsError?: string | null;
  onSelect: (command: SlashCommandId) => void;
  onSelectSkill?: (skill: v2.SkillMetadata) => void;
  onDismiss?: () => void;
  onActiveOptionChange?: (id: string | null) => void;
};

export type SlashCommandPaletteHandle = {
  handleKeyDown: (event: Pick<KeyboardEvent<HTMLDivElement>, "key" | "preventDefault">) => void;
};

const commandIcons = {
  archive: ArchiveBoxIcon,
  compact: ArrowsPointingInIcon,
  goal: FlagIcon,
};

export const SlashCommandPalette = forwardRef<SlashCommandPaletteHandle, SlashCommandPaletteProps>(
  function SlashCommandPalette(
    {
      commands = slashCommands.map((command) => command.id),
      disabled,
      id,
      query = "",
      skills = [],
      skillsLoading = false,
      skillsError = null,
      onSelect,
      onSelectSkill,
      onDismiss,
      onActiveOptionChange,
    },
    ref,
  ) {
    const { t } = useTranslation("conversation");

    const normalizedQuery = query.trim().toLowerCase();
    const visibleCommands = slashCommands.filter(
      (command) =>
        commands.includes(command.id) && `${command.id} ${command.label}`.toLowerCase().includes(normalizedQuery),
    );
    const visibleSkills = skills.filter((skill) =>
      [skill.name, skill.description, skill.shortDescription, skill.interface?.shortDescription, skill.path]
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
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const [activeIndex, setActiveIndex] = useState(0);
    const highlightedIndex = options.length ? Math.min(activeIndex, options.length - 1) : 0;
    const activeOptionId = options.length ? `slash-command-option-${highlightedIndex}` : null;
    useEffect(() => {
      onActiveOptionChange?.(activeOptionId);
    }, [activeOptionId, onActiveOptionChange]);

    function selectOption(index: number) {
      const option = options[index];
      if (disabled || !option) return;
      if (option.kind === "command") onSelect(option.command.id);
      else onSelectSkill?.(option.skill);
    }

    const handleKeyDown = useCallback(
      (event: Pick<KeyboardEvent<HTMLDivElement>, "key" | "preventDefault">) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDismiss?.();
          return;
        }
        const currentOptions = optionsRef.current;
        if (!currentOptions.length || disabled) {
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((current) => (current + direction + currentOptions.length) % currentOptions.length);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const option = currentOptions[highlightedIndex];
          if (option?.kind === "command") onSelect(option.command.id);
          else if (option?.kind === "skill") onSelectSkill?.(option.skill);
        }
      },
      [disabled, highlightedIndex, onDismiss, onSelect, onSelectSkill],
    );

    useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown]);

    function optionProps(index: number) {
      const active = index === highlightedIndex;
      return {
        className: active ? "active bg-primary/20 font-semibold text-base-content" : undefined,
        "aria-selected": active,
        "data-active": active ? "true" : undefined,
        id: `slash-command-option-${index}`,
        onMouseEnter: () => setActiveIndex(index),
        tabIndex: -1,
      };
    }

    return (
      <div
        aria-label={t("slashCommands")}
        className="mb-2 max-h-72 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2"
        data-slash-command-palette="true"
        id={id}
        role="listbox"
      >
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend
            className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60"
            id="slash-commands-heading"
          >
            {t("commands")}
          </legend>
          <ul className="menu menu-vertical w-full gap-1 p-0" role="presentation">
            {visibleCommands.map((command, index) => {
              const Icon = commandIcons[command.id];
              return (
                <li key={command.id}>
                  <button
                    aria-label={command.label}
                    {...optionProps(index)}
                    disabled={disabled}
                    onClick={() => selectOption(index)}
                    role="option"
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {command.label}
                  </button>
                </li>
              );
            })}
            {!visibleCommands.length && (
              <li className="px-2 py-2 text-xs text-base-content/60">{t("noMatchingCommands")}</li>
            )}
          </ul>
        </fieldset>
        <fieldset className="mt-2 m-0 min-w-0 border-0 p-0">
          <legend
            className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60"
            id="slash-skills-heading"
          >
            {t("skills")}
          </legend>
          {skillsLoading && (
            <p className="px-2 py-2 text-xs text-base-content/60" role="status">
              {t("loadingSkills")}
            </p>
          )}
          {!skillsLoading && skillsError && (
            <p className="px-2 py-2 text-xs text-error" role="alert">
              {skillsError}
            </p>
          )}
          {!skillsLoading && !skillsError && !skills.length && (
            <p className="px-2 py-2 text-xs text-base-content/60">{t("noSkillsAvailable")}</p>
          )}
          {!skillsLoading && !skillsError && skills.length > 0 && (
            <ul className="menu menu-vertical w-full gap-1 p-0" role="presentation">
              {visibleSkills.map((skill, skillIndex) => {
                const description = skill.interface?.shortDescription || skill.shortDescription || skill.description;
                const index = visibleCommands.length + skillIndex;
                return (
                  <li key={skill.path}>
                    <button
                      aria-label={skill.name}
                      {...optionProps(index)}
                      disabled={disabled || !onSelectSkill}
                      onClick={() => selectOption(index)}
                      role="option"
                      onMouseDown={(event) => event.preventDefault()}
                      type="button"
                    >
                      <SkillIcon className="size-5" skill={skill} />
                      <span className="min-w-0 text-left">
                        <span className="block truncate font-medium">{skill.name}</span>
                        <span className="block truncate text-xs font-normal text-base-content/65">{description}</span>
                        <span className="block truncate text-[11px] font-normal text-base-content/50">
                          {skill.scope} · {skill.path}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {!visibleSkills.length && (
                <li className="px-2 py-2 text-xs text-base-content/60">{t("noMatchingSkills")}</li>
              )}
            </ul>
          )}
        </fieldset>
      </div>
    );
  },
);
