import {
  ArrowPathIcon,
  Cog6ToothIcon,
  FolderIcon,
  PlusIcon,
  PuzzlePieceIcon,
  ServerIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import {
  useInstallPlugin,
  useMcpOauthLogin,
  useMcpServerStatus,
  usePluginList,
  useReloadMcpServers,
  useSetSkillsExtraRoots,
  useSkillsList,
  useUninstallPlugin,
  useUpgradeMarketplace,
  useWriteSkillConfig,
} from "../app-server/hooks";
import { EmptyState } from "../components/common/AsyncState";
import { SkillIcon } from "../components/common/SkillIcon";
import { StateBadge } from "../components/common/StateBadge";
import { PageContainer } from "../components/layout/PageContainer";
import { McpStatusSummary } from "../components/mcp/McpStatusSummary";
import { MarketplaceAssetImage } from "../components/plugins/MarketplaceAssetImage";
import { openBrowserWindow } from "../platform/native";
import {
  filterHiddenSkills,
  getDesktopUiPolicy,
} from "../platform/skill-policy";
import type { v2 } from "../protocol";

type CapabilityTab = "plugins" | "skills" | "mcp";

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

const SKILL_DESCRIPTION_MAX_LENGTH = 160;

function skillGroupLabel(entry: v2.SkillsListEntry): string {
  return entry.skills.length > 0 &&
    entry.skills.every((skill) => skill.scope === "system")
    ? "Default"
    : entry.cwd;
}

function skillDescription(skill: v2.SkillMetadata): {
  text: string;
  fullText: string;
} | null {
  const fullText =
    skill.interface?.shortDescription?.trim() ||
    skill.shortDescription?.trim() ||
    skill.description?.trim();
  if (!fullText) return null;

  return {
    fullText,
    text:
      fullText.length > SKILL_DESCRIPTION_MAX_LENGTH
        ? `${fullText.slice(0, SKILL_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`
        : fullText,
  };
}

export function CapabilitiesPage() {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [skillMutationPath, setSkillMutationPath] = useState<string | null>(
    null,
  );
  const [skillErrors, setSkillErrors] = useState<Record<string, string>>({});
  const [hiddenSkills, setHiddenSkills] = useState<Set<string>>(
    () => new Set(),
  );
  const [skillExtraRoots, setSkillExtraRoots] = useState<string[]>([]);
  const [skillRootError, setSkillRootError] = useState<string | null>(null);
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
  const uninstallPlugin = useUninstallPlugin();
  const upgradeMarketplace = useUpgradeMarketplace();
  const oauthLogin = useMcpOauthLogin();
  const setSkillsExtraRootsMutation = useSetSkillsExtraRoots();
  const writeSkillConfig = useWriteSkillConfig();

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

  const visibleSkillGroups = (skills.data?.data ?? [])
    .map((entry) => ({
      ...entry,
      skills: filterHiddenSkills(entry.skills, hiddenSkills),
    }))
    .filter((entry) => entry.skills.length > 0);

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
        title: "Select Skill directory",
      });
      if (typeof selected !== "string") return;
      const root = selected.trim();
      if (!root || skillExtraRoots.includes(root)) return;
      await updateSkillExtraRoots([...skillExtraRoots, root]);
    } catch (error) {
      setSkillRootError(formatErrorMessage(error));
    }
  }

  function removeSkillDirectory(root: string) {
    void updateSkillExtraRoots(
      skillExtraRoots.filter((candidate) => candidate !== root),
    );
  }

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
            aria-label={reloadMcp.isPending ? "Reloading…" : "Reload MCP"}
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
        <section className="grid gap-4">
          {!mcp.isLoading && !mcp.isError && !mcp.data?.data.length ? (
            <EmptyState icon={ServerIcon} title="No MCP servers configured." />
          ) : (
            <article className="card w-full border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body">
                <h2 className="card-title">MCP servers</h2>
                {mcp.isLoading && <span className="loading loading-spinner" />}
                {mcp.isError && (
                  <p className="text-error">
                    Unable to load MCP servers: {formatErrorMessage(mcp.error)}
                  </p>
                )}
                <ul className="space-y-2">
                  {mcp.data?.data.map((server) => (
                    <li key={server.name}>
                      <details
                        className="collapse collapse-arrow rounded-box border border-base-300 bg-base-100 shadow-sm"
                        data-testid={`mcp-server-details-${server.name}`}
                      >
                        <summary className="collapse-title flex flex-wrap items-center justify-between gap-3 pr-12 font-medium">
                          <span>{server.name}</span>
                          <McpStatusSummary
                            authStatus={server.authStatus}
                            runtimeStatus={server.runtimeStatus}
                          />
                        </summary>
                        <div className="collapse-content space-y-2 px-4 pb-4 pt-0 text-xs text-base-content/60">
                          <div className="flex flex-wrap items-center gap-3">
                            <span>
                              {Object.keys(server.tools).length} tools
                            </span>
                            {(server.authStatus === "notLoggedIn" ||
                              server.authStatus === "oAuth") && (
                              <button
                                aria-label={
                                  oauthLogin.isPending
                                    ? "Connecting…"
                                    : server.authStatus === "notLoggedIn"
                                      ? `Connect ${server.name}`
                                      : `Re-authenticate ${server.name}`
                                }
                                className="btn btn-outline btn-xs"
                                disabled={oauthLogin.isPending}
                                onClick={() =>
                                  void connectMcpServer(server.name)
                                }
                                type="button"
                              >
                                {server.authStatus === "notLoggedIn"
                                  ? `Connect ${server.name}`
                                  : `Re-authenticate ${server.name}`}
                              </button>
                            )}
                          </div>
                          {server.toolsError && (
                            <p className="text-error">{server.toolsError}</p>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          )}
        </section>
      ) : activeTab === "skills" ? (
        <section className="grid gap-4">
          <article
            className="card w-full border border-base-300 bg-base-100 shadow-sm"
            id="skills"
          >
            <div className="card-body">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="card-title">Skills</h2>
                <button
                  aria-label="Add Skill directory"
                  className="btn btn-outline btn-sm"
                  disabled={setSkillsExtraRootsMutation.isPending}
                  onClick={() => void addSkillDirectory()}
                  type="button"
                >
                  {setSkillsExtraRootsMutation.isPending ? (
                    <span
                      aria-hidden="true"
                      className="loading loading-spinner loading-xs"
                    />
                  ) : (
                    <FolderIcon aria-hidden="true" className="size-4" />
                  )}
                  Add Skill directory
                </button>
              </div>
              <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
                <p className="text-sm font-medium">
                  Additional Skill directories
                </p>
                <p className="mt-1 text-xs text-base-content/60">
                  Skills are discovered from these directories for the current
                  App Server session.
                </p>
                {skillExtraRoots.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {skillExtraRoots.map((root) => (
                      <li
                        className="flex min-w-0 items-center justify-between gap-2 text-sm"
                        key={root}
                      >
                        <span className="min-w-0 truncate" title={root}>
                          {root}
                        </span>
                        <button
                          aria-label={`Remove Skill directory ${root}`}
                          className="btn btn-ghost btn-xs shrink-0"
                          disabled={setSkillsExtraRootsMutation.isPending}
                          onClick={() => removeSkillDirectory(root)}
                          type="button"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-base-content/60">
                    No additional directories configured.
                  </p>
                )}
                {skillRootError && (
                  <p className="mt-2 text-xs text-error" role="alert">
                    Unable to update Skill directories: {skillRootError}
                  </p>
                )}
              </div>
              {skills.isLoading && <span className="loading loading-spinner" />}
              {skills.isError && (
                <p className="text-error">
                  Unable to load Skills: {formatErrorMessage(skills.error)}
                </p>
              )}
              {!skills.isLoading && !visibleSkillGroups.length && (
                <p className="text-sm text-base-content/60">
                  No Skills discovered.
                </p>
              )}
              <ul className="space-y-2">
                {visibleSkillGroups.map((entry) => (
                  <li key={entry.cwd}>
                    <details
                      className="rounded-box bg-base-200 p-3"
                      data-testid="skills-source-group"
                      open={entry.skills.length > 0}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                        <span>{skillGroupLabel(entry)}</span>
                        <span className="text-xs font-normal text-base-content/60">
                          {entry.skills.length} skill
                          {entry.skills.length === 1 ? "" : "s"}
                        </span>
                      </summary>
                      {entry.skills.length ? (
                        <ul className="mt-2 space-y-2">
                          {entry.skills.map((skill) => {
                            const pendingPath =
                              skillMutationPath ??
                              (writeSkillConfig.isPending
                                ? writeSkillConfig.variables?.path
                                : null);
                            const isPending = pendingPath === skill.path;
                            const error = skillErrors[skill.path];
                            const description = skillDescription(skill);
                            return (
                              <li
                                className="rounded-box border border-base-300 bg-base-100 p-2"
                                key={skill.path}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-start gap-2">
                                    <SkillIcon
                                      className="mt-0.5 size-6 shrink-0"
                                      skill={skill}
                                    />
                                    <div className="min-w-0">
                                      <p className="font-medium">
                                        {skill.name}
                                      </p>
                                      {description && (
                                        <p
                                          className="line-clamp-2 text-sm text-base-content/70"
                                          title={description.fullText}
                                        >
                                          {description.text}
                                        </p>
                                      )}
                                      {skill.scope !== "system" && (
                                        <p
                                          className="mt-1 truncate text-xs text-base-content/60"
                                          title={skill.path}
                                        >
                                          {skill.scope} · {skill.path}
                                        </p>
                                      )}
                                      {skill.pluginId && (
                                        <p className="text-xs text-base-content/60">
                                          {skill.pluginId}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <label className="flex shrink-0 items-center gap-2 text-sm">
                                    <span className="sr-only">
                                      Enable {skill.name}
                                    </span>
                                    <input
                                      aria-label={`Enable ${skill.name}`}
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
                                  <p
                                    className="mt-1 text-xs text-error"
                                    role="alert"
                                  >
                                    Unable to update Skill: {error}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="mt-1 font-medium">No skills</p>
                      )}
                      {entry.errors.length > 0 && (
                        <p className="mt-1 text-xs text-error">
                          {entry.errors.length} discovery errors
                        </p>
                      )}
                    </details>
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
              <EmptyState
                action={
                  <NavLink
                    className="btn btn-primary btn-sm"
                    to="/settings/marketplaces"
                  >
                    Add plugin marketplace
                  </NavLink>
                }
                icon={PuzzlePieceIcon}
                title="No plugin marketplaces yet"
              />
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
                                    const isUninstalling =
                                      uninstallPlugin.isPending;
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
                                        className={`btn btn-outline btn-square btn-sm ${isOfficialApps ? "opacity-50" : "btn-primary"}`}
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
                                    const uninstallButton = (
                                      <button
                                        aria-label={`Uninstall ${displayName}`}
                                        className="btn btn-outline btn-square btn-sm text-error"
                                        disabled={isUninstalling}
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              `Uninstall ${displayName}?`,
                                            )
                                          ) {
                                            void uninstallPlugin.mutateAsync({
                                              pluginId: plugin.id,
                                            });
                                          }
                                        }}
                                        title={`Uninstall ${displayName}`}
                                        type="button"
                                      >
                                        {isUninstalling ? (
                                          <span
                                            aria-hidden="true"
                                            className="loading loading-spinner loading-xs"
                                          />
                                        ) : (
                                          <TrashIcon
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
                                                  {plugin.installed && (
                                                    <StateBadge tone="success">
                                                      Installed
                                                    </StateBadge>
                                                  )}
                                                  {plugin.enabled && (
                                                    <StateBadge tone="success">
                                                      Enabled
                                                    </StateBadge>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </Link>
                                          <div className="flex size-8 shrink-0 items-start justify-end">
                                            {plugin.installed &&
                                              !isOfficialApps &&
                                              uninstallButton}
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
          {uninstallPlugin.isError && (
            <p className="mt-2 text-sm text-error">
              Unable to uninstall plugin:{" "}
              {formatErrorMessage(uninstallPlugin.error)}
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
