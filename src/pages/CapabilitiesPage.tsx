import {
  ArrowPathIcon,
  Cog6ToothIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import {
  useInstallPlugin,
  useMcpOauthLogin,
  useMcpServerStatus,
  usePluginList,
  useReloadMcpServers,
  useSkillsList,
  useUpgradeMarketplace,
} from "../app-server/hooks";
import {
  StateBadge,
  type StateBadgeTone,
} from "../components/common/StateBadge";
import { PageContainer } from "../components/layout/PageContainer";
import { MarketplaceAssetImage } from "../components/plugins/MarketplaceAssetImage";
import { openBrowserWindow } from "../platform/native";

type CapabilityTab = "plugins" | "skills" | "mcp";

function capabilityStatusTone(
  value: string | null | undefined,
): StateBadgeTone {
  const normalized = value?.toLowerCase().replaceAll("_", "") ?? "";
  if (
    [
      "connected",
      "running",
      "ready",
      "enabled",
      "installed",
      "authenticated",
      "loggedin",
    ].includes(normalized)
  ) {
    return "success";
  }
  if (["unavailable", "error", "failed", "disconnected"].includes(normalized)) {
    return "error";
  }
  if (["notloggedin", "unauthenticated"].includes(normalized)) {
    return "warning";
  }
  return "neutral";
}

function authStatusLabel(value: string): string {
  switch (value) {
    case "oAuth":
      return "OAuth connected";
    case "bearerToken":
      return "Bearer token configured";
    case "notLoggedIn":
      return "Not connected";
    case "unsupported":
      return "Authentication unsupported";
    default:
      return "Authentication status unavailable";
  }
}

function isAuthorizationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function groupPluginsByCategory<
  T extends { interface: { category: string | null } | null },
>(plugins: T[]) {
  const groups = new Map<string, T[]>();
  for (const plugin of plugins) {
    const category = plugin.interface?.category ?? "Uncategorized";
    const group = groups.get(category);
    if (group) {
      group.push(plugin);
    } else {
      groups.set(category, [plugin]);
    }
  }
  return [...groups].map(([category, groupedPlugins]) => ({
    category,
    plugins: groupedPlugins,
  }));
}

function isOfficialApp(
  installPolicySource: string | null | undefined,
): boolean {
  return installPolicySource === "IMPLICIT_CANONICAL_APP";
}

function pluginDetailsPath(
  marketplaceName: string,
  pluginName: string,
): string {
  return `/capabilities/plugins/${encodeURIComponent(marketplaceName)}/${encodeURIComponent(pluginName)}`;
}

export function CapabilitiesPage() {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: CapabilityTab =
    requestedTab === "skills" || requestedTab === "mcp"
      ? requestedTab
      : "plugins";
  const mcp = useMcpServerStatus({ detail: "full" });
  const skills = useSkillsList();
  const plugins = usePluginList();
  const reloadMcp = useReloadMcpServers();
  const installPlugin = useInstallPlugin();
  const upgradeMarketplace = useUpgradeMarketplace();
  const oauthLogin = useMcpOauthLogin();

  async function connectMcpServer(name: string) {
    setConnectionError(null);
    try {
      const response = await oauthLogin.mutateAsync({ name });
      if (!isAuthorizationUrl(response.authorizationUrl)) {
        setConnectionError("OAuth authorization URL is invalid.");
        return;
      }
      await openBrowserWindow(response.authorizationUrl);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : "Unable to start MCP login.",
      );
    }
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">
            {activeTab === "plugins"
              ? "Plugins"
              : activeTab === "skills"
                ? "Skills"
                : "MCP"}
          </h1>
        </div>
        {activeTab === "mcp" && (
          <button
            className="btn btn-primary"
            type="button"
            disabled={reloadMcp.isPending}
            onClick={() => void reloadMcp.mutateAsync({})}
          >
            {reloadMcp.isPending ? "Reloading…" : "Reload MCP"}
          </button>
        )}
      </div>
      {activeTab === "mcp" && reloadMcp.isError && (
        <p className="alert alert-error">
          {formatErrorMessage(reloadMcp.error)}
        </p>
      )}
      {activeTab === "mcp" && connectionError && (
        <p className="alert alert-error" role="alert">
          {connectionError}
        </p>
      )}
      {activeTab === "mcp" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title">MCP servers</h2>
              {mcp.isLoading && <span className="loading loading-spinner" />}
              {mcp.isError && (
                <p className="text-error">
                  Unable to load MCP servers: {formatErrorMessage(mcp.error)}
                </p>
              )}
              {!mcp.isLoading && !mcp.data?.data.length && (
                <p className="text-sm text-base-content/60">
                  No MCP servers configured.
                </p>
              )}
              <ul className="space-y-2">
                {mcp.data?.data.map((server) => (
                  <li className="rounded-box bg-base-200 p-3" key={server.name}>
                    <div className="flex justify-between gap-3">
                      <span className="font-medium">{server.name}</span>
                      <StateBadge
                        tone={capabilityStatusTone(server.runtimeStatus)}
                      >
                        {server.runtimeStatus ?? "unavailable"}
                      </StateBadge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                      <span>{Object.keys(server.tools).length} tools</span>
                      <StateBadge
                        tone={capabilityStatusTone(server.authStatus)}
                      >
                        {authStatusLabel(server.authStatus)}
                      </StateBadge>
                      {(server.authStatus === "notLoggedIn" ||
                        server.authStatus === "oAuth") && (
                        <button
                          className="btn btn-outline btn-xs"
                          disabled={oauthLogin.isPending}
                          onClick={() => void connectMcpServer(server.name)}
                          type="button"
                        >
                          {server.authStatus === "notLoggedIn"
                            ? `Connect ${server.name}`
                            : `Re-authenticate ${server.name}`}
                        </button>
                      )}
                    </div>
                    {server.toolsError && (
                      <p className="mt-1 text-xs text-error">
                        {server.toolsError}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>
      ) : activeTab === "skills" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article
            className="card border border-base-300 bg-base-100 shadow-sm"
            id="skills"
          >
            <div className="card-body">
              <h2 className="card-title">Skills</h2>
              {skills.isLoading && <span className="loading loading-spinner" />}
              {skills.isError && (
                <p className="text-error">
                  Unable to load Skills: {formatErrorMessage(skills.error)}
                </p>
              )}
              {!skills.isLoading && !skills.data?.data.length && (
                <p className="text-sm text-base-content/60">
                  No Skills discovered.
                </p>
              )}
              <ul className="space-y-2">
                {skills.data?.data.map((entry) => (
                  <li className="rounded-box bg-base-200 p-3" key={entry.cwd}>
                    <p className="text-xs text-base-content/60">{entry.cwd}</p>
                    <p className="mt-1 font-medium">
                      {entry.skills.length
                        ? entry.skills.map((skill) => skill.name).join(", ")
                        : "No skills"}
                    </p>
                    {entry.errors.length > 0 && (
                      <p className="mt-1 text-xs text-error">
                        {entry.errors.length} discovery errors
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        </section>
      ) : (
        <section className="grid gap-4" id="plugins">
          {plugins.isLoading && <span className="loading loading-spinner" />}
          {plugins.isError && (
            <p className="text-error">
              Unable to load Plugins: {formatErrorMessage(plugins.error)}
            </p>
          )}
          {!plugins.isLoading &&
            !plugins.isError &&
            !plugins.data?.marketplaces.length && (
              <p className="text-sm text-base-content/60">
                No plugin marketplaces available.
              </p>
            )}
          <ul className="space-y-3">
            {plugins.data?.marketplaces.map((marketplace) => (
              <li
                className="rounded-box border border-base-300 bg-base-100 p-3"
                key={marketplace.name}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div
                    className="collapse collapse-arrow min-w-0 flex-1 bg-base-100"
                    data-testid="plugin-marketplace"
                  >
                    <input
                      aria-label={
                        marketplace.interface?.displayName ?? marketplace.name
                      }
                      defaultChecked
                      type="checkbox"
                    />
                    <div className="collapse-title min-h-0 py-1 font-medium">
                      <span className="block font-medium">
                        {marketplace.interface?.displayName ?? marketplace.name}
                      </span>
                      <span className="block text-xs text-base-content/60">
                        {marketplace.name} · {marketplace.plugins.length}{" "}
                        plugins
                      </span>
                    </div>
                    <div className="collapse-content px-0 pt-2">
                      <div className="mb-3 flex items-center justify-end gap-1">
                        <button
                          aria-label={`Refresh ${marketplace.interface?.displayName ?? marketplace.name}`}
                          className="btn btn-ghost btn-square btn-sm"
                          disabled={upgradeMarketplace.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            void upgradeMarketplace.mutateAsync({
                              marketplaceName: marketplace.name,
                            });
                          }}
                          title={`Refresh ${marketplace.interface?.displayName ?? marketplace.name}`}
                          type="button"
                        >
                          <ArrowPathIcon
                            aria-hidden="true"
                            className={`size-4 ${upgradeMarketplace.isPending ? "animate-spin" : ""}`}
                          />
                        </button>
                        <NavLink
                          aria-label={`Configure ${marketplace.interface?.displayName ?? marketplace.name}`}
                          className="btn btn-ghost btn-square btn-sm"
                          onClick={(event) => event.stopPropagation()}
                          title={`Configure ${marketplace.interface?.displayName ?? marketplace.name}`}
                          to="/settings/marketplaces"
                        >
                          <Cog6ToothIcon
                            aria-hidden="true"
                            className="size-4"
                          />
                        </NavLink>
                      </div>
                      <div className="space-y-4">
                        {groupPluginsByCategory(marketplace.plugins).map(
                          ({ category, plugins: categoryPlugins }) => (
                            <div
                              className="collapse collapse-arrow"
                              data-testid="plugin-category"
                              key={category}
                            >
                              <input
                                aria-label={category}
                                defaultChecked
                                type="checkbox"
                              />
                              <div className="collapse-title min-h-0 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                <h3 className="inline">{category}</h3>
                              </div>
                              <div className="collapse-content px-2">
                                <ul
                                  className="mt-2 grid gap-2 lg:grid-cols-2"
                                  data-testid="plugin-grid"
                                >
                                  {categoryPlugins.map((plugin) => {
                                    const displayName =
                                      plugin.interface?.displayName ??
                                      plugin.name;
                                    const isOfficialApps = isOfficialApp(
                                      plugin.installPolicySource,
                                    );
                                    const isRemoteOnly =
                                      marketplace.path === null;
                                    const isInstallable =
                                      !isRemoteOnly && !isOfficialApps;
                                    const isInstalling =
                                      installPlugin.isPending;
                                    const pluginLocalImage =
                                      plugin.interface?.logo ??
                                      plugin.interface?.logoDark ??
                                      plugin.interface?.composerIcon;
                                    const pluginImage =
                                      plugin.interface?.logoUrl ??
                                      plugin.interface?.logoUrlDark ??
                                      plugin.interface?.composerIconUrl;
                                    const installTooltip = isOfficialApps
                                      ? "Official Apps are not supported in Ruxex."
                                      : `Install ${displayName}`;
                                    const installButton = (
                                      <button
                                        aria-label={`Install ${displayName}`}
                                        className={`btn btn-outline btn-square btn-sm ${isOfficialApps ? "opacity-50" : ""}`}
                                        title={installTooltip}
                                        type="button"
                                        disabled={
                                          isOfficialApps || isInstalling
                                        }
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
                                          <span
                                            aria-hidden="true"
                                            className="loading loading-spinner loading-xs"
                                          />
                                        ) : (
                                          <PlusIcon
                                            aria-hidden="true"
                                            className="size-4"
                                          />
                                        )}
                                      </button>
                                    );

                                    return (
                                      <li
                                        className="rounded-box border border-base-300 bg-base-100 p-3"
                                        key={plugin.id}
                                      >
                                        <div
                                          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3"
                                          data-testid="plugin-card-content"
                                        >
                                          <Link
                                            aria-label={`View details for ${displayName}`}
                                            className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
                                            to={pluginDetailsPath(
                                              marketplace.name,
                                              plugin.name,
                                            )}
                                          >
                                            <div
                                              className="size-10 shrink-0 rounded-box bg-base-200/60"
                                              data-testid="plugin-image-slot"
                                            >
                                              <MarketplaceAssetImage
                                                alt={`${displayName} logo`}
                                                className="size-full rounded-box object-contain"
                                                localDarkSrc={
                                                  plugin.interface?.logoDark
                                                }
                                                localSrc={pluginLocalImage}
                                                darkSrc={
                                                  plugin.interface?.logoUrlDark
                                                }
                                                src={pluginImage}
                                              />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="font-medium">
                                                {displayName}
                                              </p>
                                              {plugin.interface
                                                ?.shortDescription && (
                                                <p className="break-words text-sm text-base-content/70">
                                                  {
                                                    plugin.interface
                                                      .shortDescription
                                                  }
                                                </p>
                                              )}
                                              {(plugin.enabled ||
                                                plugin.installed) && (
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                                                  <StateBadge
                                                    tone={capabilityStatusTone(
                                                      plugin.enabled
                                                        ? "enabled"
                                                        : "installed",
                                                    )}
                                                  >
                                                    {plugin.enabled
                                                      ? "enabled"
                                                      : "installed"}
                                                  </StateBadge>
                                                </div>
                                              )}
                                            </div>
                                          </Link>
                                          <div className="flex size-8 shrink-0 items-start justify-end">
                                            {!plugin.installed &&
                                              !isRemoteOnly &&
                                              (isInstallable ||
                                                isOfficialApps) &&
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
                                            Remote marketplace plugins cannot be
                                            installed here.
                                          </p>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {installPlugin.isError && (
            <p className="mt-2 text-sm text-error">
              Unable to install plugin:{" "}
              {formatErrorMessage(installPlugin.error)}
            </p>
          )}
          {upgradeMarketplace.isError && (
            <p className="mt-2 text-sm text-error">
              Unable to refresh marketplace:{" "}
              {formatErrorMessage(upgradeMarketplace.error)}
            </p>
          )}
          {plugins.data?.marketplaceLoadErrors.length ? (
            <div className="mt-2 space-y-1 text-sm text-error">
              <p>
                {plugins.data.marketplaceLoadErrors.length} marketplace errors
              </p>
              {plugins.data.marketplaceLoadErrors.map((loadError) => (
                <p key={loadError.marketplacePath} className="text-xs">
                  {loadError.marketplacePath}: {loadError.message}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      )}
    </PageContainer>
  );
}
