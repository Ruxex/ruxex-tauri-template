import {
  ChevronRightIcon,
  PuzzlePieceIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

import { usePluginList } from "../../app-server/hooks";
import { SidebarHeader } from "./SidebarHeader";

export function PluginsSidebar({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const plugins = usePluginList();
  const installedPlugins =
    plugins.data?.marketplaces
      .flatMap((marketplace) => marketplace.plugins)
      .filter((plugin) => plugin.installed) ?? [];

  function selectTab(tab: "plugins" | "skills") {
    void navigate(
      tab === "plugins" ? "/capabilities" : "/capabilities?tab=skills",
    );
  }

  return (
    <aside
      aria-label="Plugins sidebar"
      className="h-full min-h-0 w-72 overflow-y-auto bg-base-100 p-4"
    >
      <SidebarHeader label="Plugins" onClose={onClose} />
      <nav aria-label="Plugin sections" className="menu w-full gap-1 p-0">
        <li>
          <button type="button" onClick={() => selectTab("plugins")}>
            <PuzzlePieceIcon aria-hidden="true" className="size-4" />
            Plugins
          </button>
        </li>
        <li>
          <button type="button" onClick={() => selectTab("skills")}>
            <SparklesIcon aria-hidden="true" className="size-4" />
            Skills
          </button>
        </li>
      </nav>
      <details className="group mt-5 rounded-box">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-box px-3 py-2 text-xs font-semibold uppercase tracking-wide text-base-content/60 hover:bg-base-200">
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 transition-transform group-open:rotate-90"
          />
          <span>Installed</span>
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
                    className="w-full justify-start"
                    type="button"
                    onClick={() => selectTab("plugins")}
                  >
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
