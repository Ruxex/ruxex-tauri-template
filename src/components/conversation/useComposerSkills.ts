import { useEffect, useState } from "react";

import { useSkillsList } from "../../app-server/hooks";
import {
  filterHiddenSkills,
  getDesktopUiPolicy,
} from "../../platform/skill-policy";

export function useComposerSkills() {
  const skills = useSkillsList();
  const [hiddenSkills, setHiddenSkills] = useState<Set<string>>(
    () => new Set(),
  );

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

  const visibleSkills = filterHiddenSkills(
    skills.data?.data.flatMap((entry) => entry.skills) ?? [],
    hiddenSkills,
  ).filter((skill) => skill.enabled);

  return { skills, visibleSkills };
}
