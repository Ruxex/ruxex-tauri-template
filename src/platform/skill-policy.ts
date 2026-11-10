import { invoke } from "@tauri-apps/api/core";

import { isNativeDesktopRuntime } from "../app-server/runtime";

export type DesktopUiPolicy = {
  hiddenSkills: string[];
};

export function filterHiddenSkills<T extends { name: string }>(
  skills: T[],
  hiddenSkills: ReadonlySet<string>,
): T[] {
  return skills.filter((skill) => !hiddenSkills.has(skill.name));
}

const defaultPolicy: DesktopUiPolicy = { hiddenSkills: [] };
let policyRequest: Promise<DesktopUiPolicy> | null = null;

export function getDesktopUiPolicy(): Promise<DesktopUiPolicy> {
  if (!isNativeDesktopRuntime) {
    return Promise.resolve(defaultPolicy);
  }
  if (!policyRequest) {
    policyRequest = invoke<DesktopUiPolicy>("get_desktop_ui_policy").catch(
      (error) => {
        policyRequest = null;
        throw error;
      },
    );
  }
  return policyRequest;
}
