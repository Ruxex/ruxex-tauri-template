import {
  useCollaborationModes,
  useMcpServerStatus,
  usePluginList,
  useReloadMcpServers,
  useSkillsList,
} from "../app-server/hooks";

export function CapabilitiesPage() {
  const mcp = useMcpServerStatus({ detail: "full" });
  const skills = useSkillsList();
  const plugins = usePluginList();
  const collaborationModes = useCollaborationModes();
  const reloadMcp = useReloadMcpServers();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Extensions
          </p>
          <h1 className="text-3xl font-semibold">Capabilities</h1>
          <p className="mt-2 text-sm text-base-content/70">
            Server-backed MCP servers, Skills, Plugins, and collaboration modes.
          </p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          disabled={reloadMcp.isPending}
          onClick={() => void reloadMcp.mutateAsync({})}
        >
          {reloadMcp.isPending ? "Reloading…" : "Reload MCP"}
        </button>
      </div>
      {reloadMcp.isError && (
        <p className="alert alert-error">{String(reloadMcp.error)}</p>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">MCP servers</h2>
            {mcp.isLoading && <span className="loading loading-spinner" />}
            {mcp.isError && (
              <p className="text-error">
                Unable to load MCP servers: {String(mcp.error)}
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
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Skills</h2>
            {skills.isLoading && <span className="loading loading-spinner" />}
            {skills.isError && (
              <p className="text-error">
                Unable to load Skills: {String(skills.error)}
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
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Plugins</h2>
            {plugins.isLoading && <span className="loading loading-spinner" />}
            {plugins.isError && (
              <p className="text-error">
                Unable to load Plugins: {String(plugins.error)}
              </p>
            )}
            <ul className="space-y-3">
              {plugins.data?.marketplaces.map((marketplace) => (
                <li key={marketplace.name}>
                  <p className="font-medium">{marketplace.name}</p>
                  <p className="text-sm text-base-content/60">
                    {marketplace.plugins.length} plugins
                  </p>
                </li>
              ))}
            </ul>
            {plugins.data?.marketplaceLoadErrors.length ? (
              <p className="mt-2 text-sm text-error">
                {plugins.data.marketplaceLoadErrors.length} marketplace errors
              </p>
            ) : null}
          </div>
        </article>
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title">Collaboration modes</h2>
            {collaborationModes.isLoading && (
              <span className="loading loading-spinner" />
            )}
            {collaborationModes.isError && (
              <p className="text-error">
                Unable to load collaboration modes:{" "}
                {String(collaborationModes.error)}
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
