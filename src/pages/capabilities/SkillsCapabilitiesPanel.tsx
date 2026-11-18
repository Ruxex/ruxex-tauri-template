import { FolderIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatErrorMessage } from "@/app/error-message";
import { useSetSkillsExtraRoots, useSkillsList, useWriteSkillConfig } from "@/app-server/hooks";
import { SkillIcon } from "@/components/base/common/SkillIcon";
import { filterHiddenSkills, getDesktopUiPolicy } from "@/platform/skill-policy";
import type { v2 } from "@/protocol";
import { skillDescription, skillGroupLabel } from "@/pages/capabilities-model";

function isWithinSkillRoot(path: string, root: string): boolean {
  if (typeof path !== "string" || typeof root !== "string") return false;
  const normalizedPath = path.replaceAll("\\", "/").replace(/\/+$/, "");
  const normalizedRoot = root.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function SkillsCapabilitiesPanel({ active }: { active: boolean }) {
  const { t } = useTranslation("capabilities");
  const skills = useSkillsList({}, active);
  const setSkillsExtraRootsMutation = useSetSkillsExtraRoots();
  const writeSkillConfig = useWriteSkillConfig();
  const [skillMutationPath, setSkillMutationPath] = useState<string | null>(null);
  const [skillErrors, setSkillErrors] = useState<Record<string, string>>({});
  const [hiddenSkills, setHiddenSkills] = useState<Set<string>>(() => new Set());
  const [defaultSkillRoots, setDefaultSkillRoots] = useState<string[]>([]);
  const [userSkillRoots, setUserSkillRoots] = useState<string[]>([]);
  const [skillExtraRoots, setSkillExtraRoots] = useState<string[]>([]);
  const [skillRootError, setSkillRootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getDesktopUiPolicy()
      .then((policy) => {
        if (!cancelled) {
          setHiddenSkills(new Set(policy.hiddenSkills));
          setDefaultSkillRoots(policy.defaultSkillRoots ?? []);
          setUserSkillRoots(policy.userSkillRoots ?? []);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleEntries = (skills.data?.data ?? []).map((entry) => ({
    ...entry,
    skills: filterHiddenSkills(entry.skills, hiddenSkills),
  }));
  const allVisibleSkills = visibleEntries.flatMap((entry) => entry.skills);
  const vendoredSkills = allVisibleSkills.filter((skill) =>
    defaultSkillRoots.some((root) => isWithinSkillRoot(skill.path, root)),
  );
  const userSkills = allVisibleSkills.filter((skill) =>
    userSkillRoots.some((root) => isWithinSkillRoot(skill.path, root)),
  );
  const visibleSkillGroups = [
    ...(vendoredSkills.length > 0
      ? [
          {
            groupKey: "vendored",
            groupLabel: t("default", { ns: "plugins" }),
            skills: vendoredSkills,
            errors: [],
          },
        ]
      : []),
    ...(userSkills.length > 0
      ? [
          {
            groupKey: "user-agents",
            groupLabel: "~/.agents/skills",
            skills: userSkills,
            errors: [],
          },
        ]
      : []),
    ...visibleEntries.flatMap((entry) => {
      const otherSkills = entry.skills.filter(
        (skill) => !vendoredSkills.includes(skill) && !userSkills.includes(skill),
      );
      return otherSkills.length > 0
        ? [
            {
              ...entry,
              groupKey: `other:${entry.cwd}`,
              groupLabel: skillGroupLabel({ ...entry, skills: otherSkills }),
              skills: otherSkills,
            },
          ]
        : [];
    }),
  ];

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
        title: t("selectSkillDirectory"),
      });
      if (typeof selected !== "string") return;
      const root = selected.trim();
      if (!root || skillExtraRoots.includes(root)) return;
      const policy = await getDesktopUiPolicy();
      if (policy.defaultSkillRoots.includes(root)) return;
      await updateSkillExtraRoots([...skillExtraRoots, root]);
    } catch (error) {
      setSkillRootError(formatErrorMessage(error));
    }
  }

  function removeSkillDirectory(root: string) {
    void updateSkillExtraRoots(skillExtraRoots.filter((candidate) => candidate !== root));
  }

  return active ? (
    <section className="grid gap-4" id="skills">
      <div className="flex justify-end">
        <button
          aria-label={t("addSkillDirectory")}
          className="btn btn-outline btn-sm gap-1"
          disabled={setSkillsExtraRootsMutation.isPending}
          onClick={() => void addSkillDirectory()}
          type="button"
        >
          {setSkillsExtraRootsMutation.isPending ? (
            <span aria-hidden="true" className="loading loading-spinner loading-xs" />
          ) : (
            <FolderIcon aria-hidden="true" className="size-4" />
          )}
          {t("addSkillDirectory")}
        </button>
      </div>
      {skillExtraRoots.length > 0 && (
        <ul aria-label={t("addedSkillDirectories")} className="grid gap-1">
          {skillExtraRoots.map((root) => (
            <li
              className="flex min-w-0 items-center justify-between gap-2 rounded-box bg-base-200/40 px-3 py-2 text-sm"
              key={root}
            >
              <span className="flex min-w-0 items-center gap-2">
                <FolderIcon aria-hidden="true" className="size-4 shrink-0 text-base-content/55" />
                <span className="min-w-0 truncate" title={root}>
                  {root}
                </span>
              </span>
              <button
                aria-label={t("removeSkillDirectory", { name: root })}
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
          {t("unableToUpdateSkillDirectories", { details: skillRootError })}
        </p>
      )}
      {skills.isLoading && <span className="loading loading-spinner" />}
      {skills.isError && (
        <p className="text-error">
          {t("unableToLoadSkills", {
            details: formatErrorMessage(skills.error),
          })}
        </p>
      )}
      {!skills.isLoading && !visibleSkillGroups.length && (
        <p className="text-sm text-base-content/60">{t("noSkillsDiscovered")}</p>
      )}
      <ul className="space-y-2">
        {visibleSkillGroups.map((entry) => (
          <li key={entry.groupKey}>
            <details
              className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100 shadow-sm"
              data-testid="skills-source-group"
            >
              <summary className="collapse-title flex items-center justify-between gap-3 py-3 text-sm font-medium">
                <span>{entry.groupLabel}</span>
                <span className="text-xs font-normal text-base-content/60">
                  {t("skillCount", { count: entry.skills.length })}
                </span>
              </summary>
              <div className="collapse-content p-0">
                <ul className="space-y-2 border-t border-base-300 px-4 py-3">
                  {entry.skills.map((skill) => {
                    const pendingPath =
                      skillMutationPath ?? (writeSkillConfig.isPending ? writeSkillConfig.variables?.path : null);
                    const isPending = pendingPath === skill.path;
                    const error = skillErrors[skill.path];
                    const description = skillDescription(skill);
                    return (
                      <li className="rounded-box border border-base-300 bg-base-100 px-4 py-3" key={skill.path}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <SkillIcon className="mt-0.5 size-6 shrink-0" skill={skill} />
                            <div className="min-w-0">
                              <p className="font-medium">{skill.name}</p>
                              {description && (
                                <p className="line-clamp-2 text-sm text-base-content/70" title={description.fullText}>
                                  {description.text}
                                </p>
                              )}
                              {skill.scope !== "system" && (
                                <p className="mt-1 truncate text-xs text-base-content/60" title={skill.path}>
                                  {skill.scope} · {skill.path}
                                </p>
                              )}
                              {skill.pluginId && <p className="text-xs text-base-content/60">{skill.pluginId}</p>}
                            </div>
                          </div>
                          <label className="flex shrink-0 items-center gap-2 text-sm">
                            <span className="sr-only">{t("enableSkillNamed", { name: skill.name })}</span>
                            <input
                              aria-label={t("enableSkillNamed", {
                                name: skill.name,
                              })}
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
                            {t("unableToUpdateSkill", { details: error })}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {entry.errors.length > 0 && (
                  <p className="border-t border-base-300 px-4 py-3 text-xs text-error">
                    {t("discoveryErrors", { count: entry.errors.length })}
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}
