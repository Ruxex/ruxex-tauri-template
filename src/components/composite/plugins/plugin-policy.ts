import { i18n } from "@/app/i18n";
import type { v2 } from "@/protocol";

type PluginActionsSource = Pick<v2.PluginSummary, "id" | "installed" | "installPolicySource"> | null;

export function getPluginActionPolicy(plugin: PluginActionsSource, marketplacePath: string | null) {
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
      ? i18n.t("officialAppsAreNotSupportedInRuxex", {
          ns: "plugins",
          lng: i18n.resolvedLanguage,
          brandName: i18n.t("brandName", {
            ns: "common",
            lng: i18n.resolvedLanguage,
          }),
        })
      : remote
        ? i18n.t("remoteMarketplacePluginsCannotBeInstalledHere", {
            ns: "plugins",
            lng: i18n.resolvedLanguage,
          })
        : null,
  };
}
