import { useTranslation } from "react-i18next";
import { ArrowPathIcon, Cog6ToothIcon, PlusIcon, PuzzlePieceIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Link, NavLink } from "react-router-dom";

import { formatErrorMessage } from "@/app/error-message";
import { useInstallPlugin, usePluginList, useUninstallPlugin, useUpgradeMarketplace } from "@/app-server/hooks";
import { EmptyState } from "@/components/base/common/AsyncState";
import { StateBadge } from "@/components/base/common/StateBadge";
import { MarketplaceAssetImage } from "@/components/composite/plugins/MarketplaceAssetImage";
import { getPluginActionPolicy } from "@/components/composite/plugins/plugin-policy";
import { groupPluginsByCategory, pluginDetailsPath } from "@/pages/capabilities-model";

export function PluginMarketplacePanel({ active }: { active: boolean }) {
  const { t } = useTranslation("plugins");
  const plugins = usePluginList({}, active);
  const upgradeMarketplace = useUpgradeMarketplace();
  const installPlugin = useInstallPlugin();
  const uninstallPlugin = useUninstallPlugin();

  return active ? (
    <section className="grid gap-4" id="plugins">
      {plugins.isLoading && <span className="loading loading-spinner" />}
      {plugins.isError && (
        <p className="text-error">
          {t("unableToLoadPlugins", {
            details: formatErrorMessage(plugins.error),
          })}
        </p>
      )}
      {!plugins.isLoading && !plugins.isError && !plugins.data?.marketplaces.length && (
        <EmptyState
          action={
            <NavLink className="btn btn-primary btn-sm" to="/settings/marketplaces">
              {t("addPluginMarketplace")}
            </NavLink>
          }
          icon={PuzzlePieceIcon}
          title={t("noPluginMarketplacesYet")}
        />
      )}
      <ul className="space-y-3">
        {plugins.data?.marketplaces.map((marketplace) => (
          <li className="rounded-box border border-base-300 bg-base-100 p-3" key={marketplace.name}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="collapse collapse-arrow min-w-0 flex-1 bg-base-100" data-testid="plugin-marketplace">
                <input
                  aria-label={marketplace.interface?.displayName ?? marketplace.name}
                  defaultChecked
                  type="checkbox"
                />
                <div className="collapse-title min-h-0 py-1 font-medium">
                  <span className="block font-medium">{marketplace.interface?.displayName ?? marketplace.name}</span>
                  <span className="block text-xs text-base-content/60">
                    {marketplace.name} · {t("pluginCount", { count: marketplace.plugins.length })}
                  </span>
                </div>
                <div className="collapse-content px-0 pt-2">
                  <div className="mb-3 flex items-center justify-end gap-1">
                    <button
                      aria-label={t("refreshNamed", {
                        name: marketplace.interface?.displayName ?? marketplace.name,
                      })}
                      className="btn btn-ghost btn-square btn-sm"
                      disabled={upgradeMarketplace.isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        void upgradeMarketplace.mutateAsync({
                          marketplaceName: marketplace.name,
                        });
                      }}
                      title={t("refreshNamed", {
                        name: marketplace.interface?.displayName ?? marketplace.name,
                      })}
                      type="button"
                    >
                      <ArrowPathIcon
                        aria-hidden="true"
                        className={`size-4 ${upgradeMarketplace.isPending ? "animate-spin" : ""}`}
                      />
                    </button>
                    <NavLink
                      aria-label={t("configureNamed", {
                        name: marketplace.interface?.displayName ?? marketplace.name,
                      })}
                      className="btn btn-ghost btn-square btn-sm"
                      onClick={(event) => event.stopPropagation()}
                      title={t("configureNamed", {
                        name: marketplace.interface?.displayName ?? marketplace.name,
                      })}
                      to="/settings/marketplaces"
                    >
                      <Cog6ToothIcon aria-hidden="true" className="size-4" />
                    </NavLink>
                  </div>
                  <div className="space-y-4">
                    {groupPluginsByCategory(marketplace.plugins).map(({ category, plugins: categoryPlugins }) => (
                      <div className="collapse collapse-arrow" data-testid="plugin-category" key={category}>
                        <input aria-label={category} defaultChecked type="checkbox" />
                        <div className="collapse-title min-h-0 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                          <h3 className="inline">{category}</h3>
                        </div>
                        <div className="collapse-content px-2">
                          <ul className="mt-2 grid gap-2 lg:grid-cols-2" data-testid="plugin-grid">
                            {categoryPlugins.map((plugin) => {
                              const displayName = plugin.interface?.displayName ?? plugin.name;
                              const actionPolicy = getPluginActionPolicy(plugin, marketplace.path);
                              const isOfficialApps = actionPolicy.official;
                              const isRemoteOnly = actionPolicy.remote;
                              const isInstalling = installPlugin.isPending;
                              const isUninstalling = uninstallPlugin.isPending;
                              const pluginLocalImage =
                                plugin.interface?.logo ?? plugin.interface?.logoDark ?? plugin.interface?.composerIcon;
                              const pluginImage =
                                plugin.interface?.logoUrl ??
                                plugin.interface?.logoUrlDark ??
                                plugin.interface?.composerIconUrl;
                              const installTooltip =
                                actionPolicy.installTitle ?? t("installNamed", { name: displayName });
                              const installButton = (
                                <button
                                  aria-label={t("installNamed", {
                                    name: displayName,
                                  })}
                                  className={`btn btn-outline btn-square btn-sm ${isOfficialApps ? "opacity-50" : "btn-primary"}`}
                                  title={installTooltip}
                                  type="button"
                                  disabled={actionPolicy.installDisabled || isInstalling}
                                  onClick={() => {
                                    if (marketplace.path) {
                                      void installPlugin.mutateAsync({
                                        marketplacePath: marketplace.path,
                                        pluginName: plugin.name,
                                      });
                                    }
                                  }}
                                >
                                  {isInstalling ? (
                                    <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                                  ) : (
                                    <PlusIcon aria-hidden="true" className="size-4" />
                                  )}
                                </button>
                              );
                              const uninstallButton = (
                                <button
                                  aria-label={t("uninstallNamed", {
                                    name: displayName,
                                  })}
                                  className="btn btn-outline btn-square btn-sm text-error"
                                  disabled={isUninstalling}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        t("uninstallConfirm", {
                                          name: displayName,
                                        }),
                                      )
                                    ) {
                                      void uninstallPlugin.mutateAsync({
                                        pluginId: plugin.id,
                                      });
                                    }
                                  }}
                                  title={t("uninstallNamed", {
                                    name: displayName,
                                  })}
                                  type="button"
                                >
                                  {isUninstalling ? (
                                    <span aria-hidden="true" className="loading loading-spinner loading-xs" />
                                  ) : (
                                    <TrashIcon aria-hidden="true" className="size-4" />
                                  )}
                                </button>
                              );

                              return (
                                <li className="rounded-box border border-base-300 bg-base-100 p-3" key={plugin.id}>
                                  <div
                                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3"
                                    data-testid="plugin-card-content"
                                  >
                                    <Link
                                      aria-label={t("viewNamedDetails", {
                                        name: displayName,
                                      })}
                                      className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
                                      to={pluginDetailsPath(marketplace.name, plugin.name)}
                                    >
                                      <div
                                        className="size-10 shrink-0 rounded-box bg-base-200/60"
                                        data-testid="plugin-image-slot"
                                      >
                                        <MarketplaceAssetImage
                                          alt={`${displayName} logo`}
                                          className="size-full rounded-box object-contain"
                                          localDarkSrc={plugin.interface?.logoDark}
                                          localSrc={pluginLocalImage}
                                          darkSrc={plugin.interface?.logoUrlDark}
                                          src={pluginImage}
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium">{displayName}</p>
                                        {plugin.interface?.shortDescription && (
                                          <p className="break-words text-sm text-base-content/70">
                                            {plugin.interface.shortDescription}
                                          </p>
                                        )}
                                        {(plugin.enabled || plugin.installed) && (
                                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                                            {plugin.installed && (
                                              <StateBadge tone="success">{t("installed")}</StateBadge>
                                            )}
                                            {plugin.enabled && <StateBadge tone="success">{t("enabled")}</StateBadge>}
                                          </div>
                                        )}
                                      </div>
                                    </Link>
                                    <div className="flex size-8 shrink-0 items-start justify-end">
                                      {plugin.installed && !isOfficialApps && uninstallButton}
                                      {!plugin.installed &&
                                        !isRemoteOnly &&
                                        (actionPolicy.canInstall || isOfficialApps) &&
                                        (isOfficialApps ? (
                                          <span
                                            className="inline-flex"
                                            data-testid="official-app-install-tooltip"
                                            title={installTooltip}
                                          >
                                            {installButton}
                                          </span>
                                        ) : (
                                          installButton
                                        ))}
                                    </div>
                                  </div>
                                  {isRemoteOnly && !plugin.installed && (
                                    <p className="mt-2 text-xs text-base-content/60">
                                      {t("remoteMarketplacePluginsCannotBeInstalledHere")}
                                    </p>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {installPlugin.isError && (
        <p className="mt-2 text-sm text-error">
          {t("unableToInstallPlugin", {
            details: formatErrorMessage(installPlugin.error),
          })}
        </p>
      )}
      {uninstallPlugin.isError && (
        <p className="mt-2 text-sm text-error">
          {t("unableToUninstallPlugin", {
            details: formatErrorMessage(uninstallPlugin.error),
          })}
        </p>
      )}
      {upgradeMarketplace.isError && (
        <p className="mt-2 text-sm text-error">
          {t("unableToRefreshMarketplace", {
            details: formatErrorMessage(upgradeMarketplace.error),
          })}
        </p>
      )}
      {plugins.data?.marketplaceLoadErrors.length ? (
        <div className="mt-2 space-y-1 text-sm text-error">
          <p>
            {t("marketplaceErrors", {
              count: plugins.data.marketplaceLoadErrors.length,
            })}
          </p>
          {plugins.data.marketplaceLoadErrors.map((loadError) => (
            <p key={loadError.marketplacePath} className="text-xs">
              {loadError.marketplacePath}: {loadError.message}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  ) : null;
}
