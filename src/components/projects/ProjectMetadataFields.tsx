import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

import type { ProjectMetadata } from "./project-metadata";
import {
  PROJECT_COLOR_OPTIONS,
  PROJECT_ICON_OPTIONS,
  projectColorClassName,
} from "./project-metadata";
import { ProjectIcon } from "./ProjectIcon";

type ProjectMetadataFieldsProps = {
  value: ProjectMetadata;
  onChange: (value: ProjectMetadata) => void;
};

type OpenSelector = "icon" | "color" | null;

type ProjectIconPreviewProps = {
  value: ProjectMetadata;
};

const PROJECT_COLOR_SWATCH_CLASSES: Record<ProjectMetadata["color"], string> = {
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  red: "bg-red-500",
  rose: "bg-rose-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  slate: "bg-slate-500",
};

export function ProjectMetadataFields({
  value,
  onChange,
}: ProjectMetadataFieldsProps) {
  const [openSelector, setOpenSelector] = useState<OpenSelector>(null);
  const iconSelectorRef = useRef<HTMLDivElement>(null);
  const colorSelectorRef = useRef<HTMLDivElement>(null);
  const iconTriggerRef = useRef<HTMLButtonElement>(null);
  const colorTriggerRef = useRef<HTMLButtonElement>(null);
  const selectedIcon =
    PROJECT_ICON_OPTIONS.find((option) => option.value === value.icon) ??
    PROJECT_ICON_OPTIONS[0];
  const selectedColor =
    PROJECT_COLOR_OPTIONS.find((option) => option.value === value.color) ??
    PROJECT_COLOR_OPTIONS[0];

  useEffect(() => {
    if (!openSelector) return;

    function handlePointerDown(event: PointerEvent) {
      const activeSelectorRef =
        openSelector === "icon" ? iconSelectorRef : colorSelectorRef;
      if (!activeSelectorRef.current?.contains(event.target as Node)) {
        setOpenSelector(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenSelector(null);
        if (openSelector === "icon") {
          iconTriggerRef.current?.focus();
        } else {
          colorTriggerRef.current?.focus();
        }
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openSelector]);

  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3">
      <ProjectIconPreview value={value} selectedIcon={selectedIcon.value} />
      <section
        aria-label="Project metadata controls"
        className="grid grid-cols-2 gap-3"
      >
        <div className="form-control w-full" ref={iconSelectorRef}>
          <div className="relative">
            <button
              aria-expanded={openSelector === "icon"}
              aria-haspopup="menu"
              aria-label={`Project icon: ${selectedIcon.label}`}
              className="btn min-h-11 w-full justify-center gap-2 border-base-300 bg-base-100 font-normal hover:border-base-content/30 hover:bg-base-200"
              ref={iconTriggerRef}
              type="button"
              onClick={() =>
                setOpenSelector((current) =>
                  current === "icon" ? null : "icon",
                )
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <ProjectIcon
                  aria-hidden="true"
                  className="size-5 shrink-0"
                  icon={selectedIcon.value}
                />
              </span>
              <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
            </button>
            {openSelector === "icon" && (
              <fieldset
                aria-label="Project icon options"
                className="absolute z-20 mt-2 grid w-full grid-cols-4 gap-2 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg"
              >
                {PROJECT_ICON_OPTIONS.map((option) => {
                  const selected = value.icon === option.value;
                  return (
                    <button
                      aria-label={option.label}
                      aria-pressed={selected}
                      className={`btn btn-square ${selected ? "btn-primary" : "btn-ghost"}`}
                      key={option.value}
                      title={option.label}
                      type="button"
                      onClick={() => {
                        onChange({ ...value, icon: option.value });
                        setOpenSelector(null);
                        iconTriggerRef.current?.focus();
                      }}
                    >
                      <ProjectIcon
                        aria-hidden="true"
                        className="size-5"
                        icon={option.value}
                      />
                    </button>
                  );
                })}
              </fieldset>
            )}
          </div>
        </div>

        <div className="form-control w-full" ref={colorSelectorRef}>
          <div className="relative">
            <button
              aria-expanded={openSelector === "color"}
              aria-haspopup="menu"
              aria-label={`Project color: ${selectedColor.label}`}
              className="btn min-h-11 w-full justify-center gap-2 border-base-300 bg-base-100 font-normal hover:border-base-content/30 hover:bg-base-200"
              ref={colorTriggerRef}
              type="button"
              onClick={() =>
                setOpenSelector((current) =>
                  current === "color" ? null : "color",
                )
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-3 shrink-0 rounded-full ${PROJECT_COLOR_SWATCH_CLASSES[selectedColor.value]}`}
                />
              </span>
              <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
            </button>
            {openSelector === "color" && (
              <fieldset
                aria-label="Project color options"
                className="absolute z-20 mt-2 grid w-full grid-cols-4 gap-2 rounded-xl border border-base-300 bg-base-100 p-2 shadow-lg"
              >
                {PROJECT_COLOR_OPTIONS.map((option) => {
                  const selected = value.color === option.value;
                  return (
                    <button
                      aria-label={option.label}
                      aria-pressed={selected}
                      className={`btn btn-square ${selected ? "bg-base-200 ring-2 ring-primary" : "btn-ghost"}`}
                      key={option.value}
                      title={option.label}
                      type="button"
                      onClick={() => {
                        onChange({ ...value, color: option.value });
                        setOpenSelector(null);
                        colorTriggerRef.current?.focus();
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={`size-3 shrink-0 rounded-full ${PROJECT_COLOR_SWATCH_CLASSES[option.value]}`}
                      />
                    </button>
                  );
                })}
              </fieldset>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ProjectIconPreview({
  value,
  selectedIcon,
}: ProjectIconPreviewProps & { selectedIcon: ProjectMetadata["icon"] }) {
  return (
    <span
      aria-label="Project preview"
      className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${projectColorClassName(value.color)}`}
      role="img"
    >
      <ProjectIcon aria-hidden="true" className="size-6" icon={selectedIcon} />
    </span>
  );
}
