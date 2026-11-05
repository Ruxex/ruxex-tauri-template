import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { usePluginList, usePluginRead } from "../app-server/hooks";
import { PageContainer } from "../components/layout/PageContainer";
import { MarketplaceAssetImage } from "../components/plugins/MarketplaceAssetImage";

function isHttpUrl(value: string | null | undefined): value is string {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function PluginDetailPage() {
  const { marketplaceName = "", pluginName = "" } = useParams<{
    marketplaceName: string;
    pluginName: string;
  }>();
  const plugins = usePluginList();
  const marketplace = plugins.data?.marketplaces.find(
    (entry) => entry.name === marketplaceName,
  );
  const summary = marketplace?.plugins.find(
    (plugin) => plugin.name === pluginName,
  );
  const details = usePluginRead(
    marketplace?.path && pluginName
      ? { marketplacePath: marketplace.path, pluginName }
      : null,
  );
  const plugin = details.data?.plugin;
  const interfaceData = plugin?.summary.interface ?? summary?.interface;
  const displayName =
    interfaceData?.displayName ??
    plugin?.summary.name ??
    summary?.name ??
    pluginName;
  const description =
    plugin?.description ??
    interfaceData?.longDescription ??
    interfaceData?.shortDescription;

  if (plugins.isLoading) {
    return (
      <PageContainer>
        <span className="loading loading-spinner" />
      </PageContainer>
    );
  }

  if (plugins.isError) {
    return (
      <PageContainer>
        <p className="text-error">
          Unable to load plugin: {formatErrorMessage(plugins.error)}
        </p>
      </PageContainer>
    );
  }

  if (!summary || !marketplace) {
    return (
      <PageContainer>
        <h1 className="text-3xl font-semibold">Plugin not found</h1>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <header className="flex flex-wrap items-start gap-4">
        <div className="size-20 shrink-0 rounded-box border border-base-300 bg-base-100 p-2">
          <MarketplaceAssetImage
            alt={`${displayName} logo`}
            className="size-full rounded-box object-contain"
            localDarkSrc={interfaceData?.logoDark}
            localSrc={interfaceData?.logo ?? interfaceData?.composerIcon}
            darkSrc={interfaceData?.logoUrlDark}
            src={interfaceData?.logoUrl ?? interfaceData?.composerIconUrl}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-base-content/60">
            {marketplace.interface?.displayName ?? marketplace.name}
          </p>
          <h1 className="text-3xl font-semibold">{displayName}</h1>
          {interfaceData?.developerName && (
            <p className="mt-1 text-sm text-base-content/60">
              by {interfaceData.developerName}
            </p>
          )}
          {isHttpUrl(interfaceData?.websiteUrl) && (
            <a
              className="link link-primary mt-2 inline-flex items-center gap-1 text-sm"
              href={interfaceData.websiteUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open website
              <ArrowTopRightOnSquareIcon
                aria-hidden="true"
                className="size-3.5"
              />
            </a>
          )}
        </div>
      </header>
      {details.isLoading && (
        <p className="text-sm text-base-content/60">Loading plugin details…</p>
      )}
      {details.isError && (
        <p className="alert alert-error">
          Unable to load full plugin details:{" "}
          {formatErrorMessage(details.error)}
        </p>
      )}
      {!marketplace.path && !plugin && (
        <p className="alert alert-info">
          Detailed plugin metadata is unavailable for remote-only marketplaces.
        </p>
      )}
      {description && (
        <section>
          <h2 className="text-xl font-semibold">About</h2>
          <p className="mt-2 whitespace-pre-wrap text-base-content/80">
            {description}
          </p>
        </section>
      )}
      {plugin && (
        <div className="grid gap-4 lg:grid-cols-3">
          {plugin.skills.length > 0 && (
            <section className="rounded-box border border-base-300 bg-base-100 p-4">
              <h2 className="font-semibold">Skills</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {plugin.skills.map((skill) => (
                  <li key={skill.name}>
                    <p className="font-medium">{skill.name}</p>
                    <p className="text-base-content/70">{skill.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {plugin.mcpServers.length > 0 && (
            <section className="rounded-box border border-base-300 bg-base-100 p-4">
              <h2 className="font-semibold">MCP servers</h2>
              <ul className="mt-2 list-inside list-disc text-sm">
                {plugin.mcpServers.map((server) => (
                  <li key={server}>{server}</li>
                ))}
              </ul>
            </section>
          )}
          {plugin.hooks.length > 0 && (
            <section className="rounded-box border border-base-300 bg-base-100 p-4">
              <h2 className="font-semibold">Hooks</h2>
              <ul className="mt-2 list-inside list-disc text-sm">
                {plugin.hooks.map((hook) => (
                  <li key={hook.key}>{hook.key}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
