import {
  ArrowTopRightOnSquareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { usePluginList, usePluginRead } from "../app-server/hooks";
import { PageContainer } from "../components/layout/PageContainer";
import { MarketplaceAssetImage } from "../components/plugins/MarketplaceAssetImage";
import { PluginInformationItem } from "../components/plugins/PluginInformationItem";
import type { v2 } from "../protocol";

function isHttpUrl(value: string | null | undefined): value is string {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const pluginPageClassName = "min-w-[640px]";

function getSkillShortDescription(skill: v2.SkillSummary) {
  return skill.interface?.shortDescription || skill.shortDescription || null;
}

function getPluginVersion(summary: v2.PluginSummary) {
  if (summary.localVersion) {
    return summary.localVersion;
  }

  return summary.source.type === "npm" ? summary.source.version : null;
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
  const [selectedSkill, setSelectedSkill] = useState<v2.SkillSummary | null>(
    null,
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
  const pluginSummary = plugin?.summary ?? summary;
  const detailSectionCount = plugin
    ? [
        plugin.skills.length,
        plugin.mcpServers.length,
        plugin.hooks.length,
      ].filter((count) => count > 0).length
    : 0;
  const detailGridClassName =
    detailSectionCount === 1
      ? "grid gap-4"
      : detailSectionCount === 2
        ? "grid gap-4 lg:grid-cols-2"
        : "grid gap-4 lg:grid-cols-3";
  const informationItems = [
    {
      label: "Capabilities",
      value: interfaceData?.capabilities.join(", ") ?? null,
    },
    { label: "Developer", value: interfaceData?.developerName ?? null },
    { label: "Category", value: interfaceData?.category ?? null },
    {
      label: "Version",
      value: pluginSummary ? getPluginVersion(pluginSummary) : null,
    },
    ...(isHttpUrl(interfaceData?.websiteUrl)
      ? [
          {
            href: interfaceData.websiteUrl,
            label: "Website",
            value: interfaceData.websiteUrl,
          },
        ]
      : []),
    ...(isHttpUrl(interfaceData?.privacyPolicyUrl)
      ? [
          {
            href: interfaceData.privacyPolicyUrl,
            label: "Privacy Policy",
            value: interfaceData.privacyPolicyUrl,
          },
        ]
      : []),
    ...(isHttpUrl(interfaceData?.termsOfServiceUrl)
      ? [
          {
            href: interfaceData.termsOfServiceUrl,
            label: "Terms of Service",
            value: interfaceData.termsOfServiceUrl,
          },
        ]
      : []),
  ].filter((item): item is { href?: string; label: string; value: string } =>
    Boolean(item.value),
  );

  if (plugins.isLoading) {
    return (
      <PageContainer className={pluginPageClassName}>
        <span className="loading loading-spinner" />
      </PageContainer>
    );
  }

  if (plugins.isError) {
    return (
      <PageContainer className={pluginPageClassName}>
        <p className="text-error">
          Unable to load plugin: {formatErrorMessage(plugins.error)}
        </p>
      </PageContainer>
    );
  }

  if (!summary || !marketplace) {
    return (
      <PageContainer className={pluginPageClassName}>
        <h1 className="text-3xl font-semibold">Plugin not found</h1>
      </PageContainer>
    );
  }

  return (
    <PageContainer className={pluginPageClassName}>
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
          {(interfaceData?.developerName || description) && (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {interfaceData?.developerName && (
                <p className="text-sm text-base-content/60">
                  by {interfaceData.developerName}
                </p>
              )}
              {description && (
                <p className="min-w-0 break-words whitespace-pre-wrap text-sm text-base-content/80">
                  {description}
                </p>
              )}
            </div>
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
      {plugin && (
        <div className={detailGridClassName}>
          {plugin.skills.length > 0 && (
            <section className="rounded-box border border-base-300 bg-base-100 p-4">
              <h2 className="font-semibold">Skills</h2>
              <ul className="mt-2 w-full space-y-2 text-sm">
                {plugin.skills.map((skill) => (
                  <li className="w-full" key={skill.name}>
                    <button
                      aria-label={`${skill.name}${getSkillShortDescription(skill) ? ` ${getSkillShortDescription(skill)}` : ""}`}
                      className="w-full rounded-box p-2 text-left transition hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      type="button"
                      onClick={() => setSelectedSkill(skill)}
                    >
                      <span className="block font-medium">{skill.name}</span>
                      {getSkillShortDescription(skill) && (
                        <span className="mt-1 block text-base-content/70">
                          {getSkillShortDescription(skill)}
                        </span>
                      )}
                    </button>
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
      {informationItems.length > 0 && (
        <section className="rounded-box border border-base-300 bg-base-100 p-4">
          <h2 className="font-semibold">Information</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {informationItems.map((item) => (
              <PluginInformationItem key={item.label} {...item} />
            ))}
          </dl>
        </section>
      )}
      {selectedSkill && (
        <dialog
          aria-labelledby="skill-details-title"
          className="modal"
          open
          onCancel={(event) => {
            event.preventDefault();
            setSelectedSkill(null);
          }}
        >
          <div className="modal-box w-full max-w-2xl px-5 py-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-semibold" id="skill-details-title">
                {selectedSkill.name}
              </h2>
              <button
                aria-label="Close skill details"
                className="btn btn-ghost btn-sm btn-square"
                type="button"
                onClick={() => setSelectedSkill(null)}
              >
                <XMarkIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-base-content/80">
              {selectedSkill.description}
            </p>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              aria-label="Close"
              type="button"
              onClick={() => setSelectedSkill(null)}
            >
              Close
            </button>
          </form>
        </dialog>
      )}
    </PageContainer>
  );
}
