import type { v2 } from "../../protocol";

type PluginActionsSource = Pick<
  v2.PluginSummary,
  "id" | "installed" | "installPolicySource"
> | null;

export function getPluginActionPolicy(
  plugin: PluginActionsSource,
  marketplacePath: string | null,
) {
  const official = plugin?.installPolicySource === "IMPLICIT_CANONICAL_APP";
  const remote = marketplacePath === null;
  const canInstall = Boolean(plugin && !plugin.installed);
  const canUninstall = Boolean(plugin?.installed && !official && plugin.id);

  return {
    official,
    remote,
    canInstall,
    canUninstall,
    installDisabled: official || remote,
    installTitle: official
      ? "Official Apps are not supported in Ruxex."
      : remote
        ? "Remote marketplace plugins cannot be installed here."
        : null,
  };
}
