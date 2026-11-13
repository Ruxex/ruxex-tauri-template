import {
  ChevronRightIcon,
  PuzzlePieceIcon,
  ServerIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useLocation, useNavigate } from "react-router-dom";

import { usePluginList } from "../../app-server/hooks";
import { MarketplaceAssetImage } from "../plugins/MarketplaceAssetImage";
import { SidebarHeader } from "./SidebarHeader";

export function PluginsSidebar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const plugins = usePluginList();
  const installedPlugins =
    plugins.data?.marketplaces
      .flatMap((marketplace) => marketplace.plugins)
      .filter((plugin) => plugin.installed) ?? [];
  const activeTab = location.pathname.startsWith("/capabilities/plugins")
    ? "plugins"
    : location.pathname === "/capabilities/skills"
      ? "skills"
      : "mcp";

  function selectTab(tab: "plugins" | "skills" | "mcp") {
    const paths = {
      plugins: "/capabilities/plugins",
      skills: "/capabilities/skills",
      mcp: "/capabilities/mcp",
    } as const;
    void navigate(paths[tab]);
  }

  return (
    <aside
      aria-label="Capabilities sidebar"
      className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label="Capabilities" onClose={onClose} />
      <nav aria-label="Capability sections" className="menu w-full gap-1 p-0">
        {(
          [
            ["plugins", "Plugins", PuzzlePieceIcon],
            ["skills", "Skills", SparklesIcon],
            ["mcp", "MCP", ServerIcon],
          ] as const
        ).map(([tab, label, Icon]) => (
          <li key={tab}>
            <button
              aria-current={activeTab === tab ? "page" : undefined}
              aria-label={label}
              className={activeTab === tab ? "menu-active" : undefined}
              type="button"
              onClick={() => selectTab(tab)}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          </li>
        ))}
      </nav>
      <details className="group mt-5 rounded-box">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60 hover:bg-base-200">
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-90"
          />
          <span>
            Installed{plugins.isLoading ? "" : ` (${installedPlugins.length})`}
          </span>
        </summary>
        <div className="pl-4 pt-1">
          {plugins.isLoading && (
            <span className="loading loading-spinner loading-sm" />
          )}
          {plugins.isError && (
            <p className="px-3 py-2 text-xs text-error">
              Unable to load installed plugins.
            </p>
          )}
          {!plugins.isLoading && !installedPlugins.length && (
            <p className="px-3 py-2 text-xs text-base-content/60">
              No installed plugins.
            </p>
          )}
          {installedPlugins.length > 0 && (
            <ul className="menu w-full gap-1 p-0">
              {installedPlugins.map((plugin) => (
                <li key={plugin.id}>
                  <button
                    aria-label={plugin.interface?.displayName ?? plugin.name}
                    className="w-full justify-start"
                    type="button"
                    onClick={() => selectTab("plugins")}
                  >
                    <div className="size-5 shrink-0 rounded bg-base-200/60">
                      <MarketplaceAssetImage
                        alt=""
                        className="size-full rounded object-contain"
                        localDarkSrc={plugin.interface?.logoDark}
                        localSrc={
                          plugin.interface?.logo ??
                          plugin.interface?.logoDark ??
                          plugin.interface?.composerIcon
                        }
                        darkSrc={plugin.interface?.logoUrlDark}
                        src={
                          plugin.interface?.logoUrl ??
                          plugin.interface?.logoUrlDark ??
                          plugin.interface?.composerIconUrl
                        }
                      />
                    </div>
                    <span className="truncate">
                      {plugin.interface?.displayName ?? plugin.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </aside>
  );
}
