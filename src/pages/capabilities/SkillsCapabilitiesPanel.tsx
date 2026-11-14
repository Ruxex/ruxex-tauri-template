import { FolderIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import { formatErrorMessage } from "../../app/error-message";
import {
  useSetSkillsExtraRoots,
  useSkillsList,
  useWriteSkillConfig,
} from "../../app-server/hooks";
import { SkillIcon } from "../../components/common/SkillIcon";
import {
  filterHiddenSkills,
  getDesktopUiPolicy,
} from "../../platform/skill-policy";
import type { v2 } from "../../protocol";
import { skillDescription, skillGroupLabel } from "../capabilities-model";

export function SkillsCapabilitiesPanel({ active }: { active: boolean }) {
  const skills = useSkillsList({}, active);
  const setSkillsExtraRootsMutation = useSetSkillsExtraRoots();
  const writeSkillConfig = useWriteSkillConfig();
  const [skillMutationPath, setSkillMutationPath] = useState<string | null>(
    null,
  );
  const [skillErrors, setSkillErrors] = useState<Record<string, string>>({});
  const [hiddenSkills, setHiddenSkills] = useState<Set<string>>(
    () => new Set(),
  );
  const [skillExtraRoots, setSkillExtraRoots] = useState<string[]>([]);
  const [skillRootError, setSkillRootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDesktopUiPolicy()
      .then((policy) => {
        if (!cancelled && policy.hiddenSkills.length > 0) {
          setHiddenSkills(new Set(policy.hiddenSkills));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleSkillGroups = (skills.data?.data ?? [])
    .map((entry) => ({
      ...entry,
      skills: filterHiddenSkills(entry.skills, hiddenSkills),
    }))
    .filter((entry) => entry.skills.length > 0);

  async function toggleSkill(skill: v2.SkillMetadata) {
    setSkillMutationPath(skill.path);
    setSkillErrors((current) => {
      const next = { ...current };
      delete next[skill.path];
      return next;
    });
    try {
      await writeSkillConfig.mutateAsync({
        path: skill.path,
        enabled: !skill.enabled,
      });
    } catch (error) {
      setSkillErrors((current) => ({
        ...current,
        [skill.path]: formatErrorMessage(error),
      }));
    } finally {
      setSkillMutationPath(null);
    }
  }

  async function updateSkillExtraRoots(nextRoots: string[]) {
    setSkillRootError(null);
    try {
      await setSkillsExtraRootsMutation.mutateAsync({
        extraRoots: nextRoots,
      });
      setSkillExtraRoots(nextRoots);
    } catch (error) {
      setSkillRootError(formatErrorMessage(error));
    }
  }

  async function addSkillDirectory() {
    setSkillRootError(null);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Skill directory",
      });
      if (typeof selected !== "string") return;
      const root = selected.trim();
      if (!root || skillExtraRoots.includes(root)) return;
      await updateSkillExtraRoots([...skillExtraRoots, root]);
    } catch (error) {
      setSkillRootError(formatErrorMessage(error));
    }
  }

  function removeSkillDirectory(root: string) {
    void updateSkillExtraRoots(
      skillExtraRoots.filter((candidate) => candidate !== root),
    );
  }

  return active ? (
    <section className="grid gap-4" id="skills">
      <div className="flex justify-end">
        <button
          aria-label="Add Skill directory"
          className="btn btn-outline btn-sm"
          disabled={setSkillsExtraRootsMutation.isPending}
          onClick={() => void addSkillDirectory()}
          type="button"
        >
          {setSkillsExtraRootsMutation.isPending ? (
            <span
              aria-hidden="true"
              className="loading loading-spinner loading-xs"
            />
          ) : (
            <FolderIcon aria-hidden="true" className="size-4" />
          )}
          Add Skill directory
        </button>
      </div>
      {skillExtraRoots.length > 0 && (
        <ul aria-label="Added Skill directories" className="grid gap-1">
          {skillExtraRoots.map((root) => (
            <li
              className="flex min-w-0 items-center justify-between gap-2 rounded-box bg-base-200/40 px-3 py-2 text-sm"
              key={root}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FolderIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-base-content/55"
                />
                <span className="min-w-0 truncate" title={root}>
                  {root}
                </span>
              </span>
              <button
                aria-label={`Remove Skill directory ${root}`}
                className="btn btn-ghost btn-xs shrink-0"
                disabled={setSkillsExtraRootsMutation.isPending}
                onClick={() => removeSkillDirectory(root)}
                type="button"
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {skillRootError && (
        <p className="text-sm text-error" role="alert">
          Unable to update Skill directories: {skillRootError}
        </p>
      )}
      {skills.isLoading && <span className="loading loading-spinner" />}
      {skills.isError && (
        <p className="text-error">
          Unable to load Skills: {formatErrorMessage(skills.error)}
        </p>
      )}
      {!skills.isLoading && !visibleSkillGroups.length && (
        <p className="text-sm text-base-content/60">No Skills discovered.</p>
      )}
      <ul className="space-y-2">
        {visibleSkillGroups.map((entry) => (
          <li key={entry.cwd}>
            <details
              className="rounded-box bg-base-200 p-3"
              data-testid="skills-source-group"
              open={entry.skills.length > 0}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                <span>{skillGroupLabel(entry)}</span>
                <span className="text-xs font-normal text-base-content/60">
                  {entry.skills.length} skill
                  {entry.skills.length === 1 ? "" : "s"}
                </span>
              </summary>
              {entry.skills.length ? (
                <ul className="mt-2 space-y-2">
                  {entry.skills.map((skill) => {
                    const pendingPath =
                      skillMutationPath ??
                      (writeSkillConfig.isPending
                        ? writeSkillConfig.variables?.path
                        : null);
                    const isPending = pendingPath === skill.path;
                    const error = skillErrors[skill.path];
                    const description = skillDescription(skill);
                    return (
                      <li
                        className="rounded-box border border-base-300 bg-base-100 p-2"
                        key={skill.path}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2">
                            <SkillIcon
                              className="mt-0.5 size-6 shrink-0"
                              skill={skill}
                            />
                            <div className="min-w-0">
                              <p className="font-medium">{skill.name}</p>
                              {description && (
                                <p
                                  className="line-clamp-2 text-sm text-base-content/70"
                                  title={description.fullText}
                                >
                                  {description.text}
                                </p>
                              )}
                              {skill.scope !== "system" && (
                                <p
                                  className="mt-1 truncate text-xs text-base-content/60"
                                  title={skill.path}
                                >
                                  {skill.scope} · {skill.path}
                                </p>
                              )}
                              {skill.pluginId && (
                                <p className="text-xs text-base-content/60">
                                  {skill.pluginId}
                                </p>
                              )}
                            </div>
                          </div>
                          <label className="flex shrink-0 items-center gap-2 text-sm">
                            <span className="sr-only">Enable {skill.name}</span>
                            <input
                              aria-label={`Enable ${skill.name}`}
                              aria-checked={skill.enabled}
                              checked={skill.enabled}
                              className="toggle toggle-primary toggle-sm"
                              disabled={isPending}
                              onChange={() => void toggleSkill(skill)}
                              role="switch"
                              type="checkbox"
                            />
                          </label>
                        </div>
                        {error && (
                          <p className="mt-1 text-xs text-error" role="alert">
                            Unable to update Skill: {error}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 font-medium">No skills</p>
              )}
              {entry.errors.length > 0 && (
                <p className="mt-1 text-xs text-error">
                  {entry.errors.length} discovery errors
                </p>
              )}
            </details>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}
