import { useSearchParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import {
  useCollaborationModes,
  useConfig,
  useConfigRequirements,
  useInstallPlugin,
  useMcpServerStatus,
  usePluginList,
  useReloadMcpServers,
  useSkillsList,
  useUpgradeMarketplace,
} from "../app-server/hooks";
import { BrowserComputerUseCard } from "../components/capabilities/BrowserComputerUseCard";

type CapabilityTab = "plugins" | "skills" | "mcp";

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
  const config = useConfig();
  const configRequirements = useConfigRequirements();
  const reloadMcp = useReloadMcpServers();
  const installPlugin = useInstallPlugin();
  const upgradeMarketplace = useUpgradeMarketplace();

  return (
    <div className="space-y-5">
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
      <BrowserComputerUseCard
        config={config.data?.config ?? null}
        requirements={configRequirements.data?.requirements ?? null}
      />
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
                      <span className="badge badge-ghost">
                        {server.runtimeStatus ?? "unavailable"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-base-content/60">
                      {Object.keys(server.tools).length} tools · auth{" "}
                      {server.authStatus}
                    </p>
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
        <section className="grid gap-4 lg:grid-cols-2">
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
                      <div>
                        <p className="font-medium">
                          {marketplace.interface?.displayName ??
                            marketplace.name}
                        </p>
                        <p className="text-xs text-base-content/60">
                          {marketplace.name} · {marketplace.plugins.length}{" "}
                          plugins
                        </p>
                      </div>
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
                    <ul className="mt-3 space-y-2">
                      {marketplace.plugins.map((plugin) => {
                        const displayName =
                          plugin.interface?.displayName ?? plugin.name;
                        const isInstallable = marketplace.path !== null;
                        const isInstalling = installPlugin.isPending;

                        return (
                          <li
                            className="rounded-box border border-base-300 bg-base-100 p-3"
                            key={plugin.id}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{displayName}</p>
                                {plugin.interface?.shortDescription && (
                                  <p className="text-sm text-base-content/70">
                                    {plugin.interface.shortDescription}
                                  </p>
                                )}
                                <p className="mt-1 text-xs text-base-content/60">
                                  {plugin.interface?.category ??
                                    "Uncategorized"}{" "}
                                  ·{" "}
                                  {plugin.enabled
                                    ? "enabled"
                                    : plugin.installed
                                      ? "installed"
                                      : "available"}
                                </p>
                              </div>
                              {!plugin.installed && isInstallable && (
                                <button
                                  className="btn btn-primary btn-xs"
                                  type="button"
                                  disabled={isInstalling}
                                  onClick={() =>
                                    void installPlugin.mutateAsync({
                                      marketplacePath: marketplace.path,
                                      pluginName: plugin.id,
                                    })
                                  }
                                >
                                  {isInstalling
                                    ? "Installing…"
                                    : `Install ${displayName}`}
                                </button>
                              )}
                            </div>
                            {!isInstallable && !plugin.installed && (
                              <p className="mt-2 text-xs text-base-content/60">
                                Remote marketplace plugins cannot be installed
                                here.
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
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
    </div>
  );
}
