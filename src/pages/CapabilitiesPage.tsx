import { PlusIcon } from "@heroicons/react/24/outline";
import { useSearchParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import {
  useCollaborationModes,
  useInstallPlugin,
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

export function CapabilitiesPage() {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: CapabilityTab =
    requestedTab === "skills" || requestedTab === "mcp"
      ? requestedTab
      : "plugins";
  const mcp = useMcpServerStatus({ detail: "full" });
  const skills = useSkillsList();
  const plugins = usePluginList();
  const collaborationModes = useCollaborationModes();
  const reloadMcp = useReloadMcpServers();
  const installPlugin = useInstallPlugin();
  const upgradeMarketplace = useUpgradeMarketplace();

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
                        {server.authStatus}
                      </StateBadge>
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
        <section className="grid gap-4">
          <article
            className="card border border-base-300 bg-base-100 shadow-sm"
            id="plugins"
          >
            <div className="card-body">
              <h2 className="card-title">Plugins</h2>
              {plugins.isLoading && (
                <span className="loading loading-spinner" />
              )}
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
                    className="rounded-box bg-base-200 p-3"
                    key={marketplace.name}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <details
                        className="min-w-0 flex-1"
                        data-testid="plugin-marketplace"
                        open
                      >
                        <summary className="cursor-pointer">
                          <span className="block font-medium">
                            {marketplace.interface?.displayName ??
                              marketplace.name}
                          </span>
                          <span className="block text-xs text-base-content/60">
                            {marketplace.name} · {marketplace.plugins.length}{" "}
                            plugins
                          </span>
                        </summary>
                        <div className="mt-3 space-y-4">
                          {groupPluginsByCategory(marketplace.plugins).map(
                            ({ category, plugins: categoryPlugins }) => (
                              <details
                                className="group"
                                data-testid="plugin-category"
                                key={category}
                                open
                              >
                                <summary className="cursor-pointer">
                                  <h3 className="inline text-xs font-semibold uppercase tracking-wide text-base-content/60">
                                    {category}
                                  </h3>
                                </summary>
                                <ul className="mt-2 space-y-2">
                                  {categoryPlugins.map((plugin) => {
                                    const displayName =
                                      plugin.interface?.displayName ??
                                      plugin.name;
                                    const isInstallable =
                                      marketplace.path !== null;
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

                                    return (
                                      <li
                                        className="rounded-box border border-base-300 bg-base-100 p-3"
                                        key={plugin.id}
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                          <div className="flex min-w-0 items-start gap-3">
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
                                                <p className="text-sm text-base-content/70">
                                                  {
                                                    plugin.interface
                                                      .shortDescription
                                                  }
                                                </p>
                                              )}
                                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
                                                <StateBadge
                                                  tone={capabilityStatusTone(
                                                    plugin.enabled
                                                      ? "enabled"
                                                      : plugin.installed
                                                        ? "installed"
                                                        : "available",
                                                  )}
                                                >
                                                  {plugin.enabled
                                                    ? "enabled"
                                                    : plugin.installed
                                                      ? "installed"
                                                      : "available"}
                                                </StateBadge>
                                              </div>
                                            </div>
                                          </div>
                                          {!plugin.installed &&
                                            isInstallable && (
                                              <button
                                                aria-label={`Install ${displayName}`}
                                                className="btn btn-outline btn-square btn-sm"
                                                title={`Install ${displayName}`}
                                                type="button"
                                                disabled={isInstalling}
                                                onClick={() =>
                                                  void installPlugin.mutateAsync(
                                                    {
                                                      marketplacePath:
                                                        marketplace.path,
                                                      pluginName: plugin.name,
                                                    },
                                                  )
                                                }
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
                                            )}
                                        </div>
                                        {!isInstallable &&
                                          !plugin.installed && (
                                            <p className="mt-2 text-xs text-base-content/60">
                                              Remote marketplace plugins cannot
                                              be installed here.
                                            </p>
                                          )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </details>
                            ),
                          )}
                        </div>
                      </details>
                      <button
                        className="btn btn-ghost btn-xs"
                        type="button"
                        disabled={upgradeMarketplace.isPending}
                        onClick={() =>
                          void upgradeMarketplace.mutateAsync({
                            marketplaceName: marketplace.name,
                          })
                        }
                      >
                        {upgradeMarketplace.isPending
                          ? "Refreshing…"
                          : `Refresh ${marketplace.interface?.displayName ?? marketplace.name}`}
                      </button>
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
                    {plugins.data.marketplaceLoadErrors.length} marketplace
                    errors
                  </p>
                  {plugins.data.marketplaceLoadErrors.map((loadError) => (
                    <p key={loadError.marketplacePath} className="text-xs">
                      {loadError.marketplacePath}: {loadError.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </section>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Collaboration modes</h2>
            {collaborationModes.isLoading && (
              <span className="loading loading-spinner" />
            )}
            {collaborationModes.isError && (
              <p className="text-error">
                Unable to load collaboration modes:{" "}
                {formatErrorMessage(collaborationModes.error)}
              </p>
            )}
            <ul className="space-y-2">
              {collaborationModes.data?.data.map((mode) => (
                <li
                  className="flex justify-between gap-3 rounded-box bg-base-200 p-3"
                  key={mode.name}
                >
                  <span>{mode.name}</span>
                  <span className="text-sm text-base-content/60">
                    {mode.model ?? "default model"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </section>
    </PageContainer>
  );
}
