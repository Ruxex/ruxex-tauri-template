import { useTranslation } from "react-i18next";
import { PuzzlePieceIcon } from "@heroicons/react/24/outline";
import { type FormEvent, useMemo, useState } from "react";

import { formatErrorMessage } from "@/app/error-message";
import { useConfig, usePluginList, useUpgradeMarketplace } from "@/app-server/hooks";
import { SettingsPanel } from "@/components/feature/settings/SettingsCards";
import { FormFieldRow } from "@/components/base/common/FormFieldRow";
import { useMarketplaceSettingsActions } from "./useMarketplaceSettingsActions";

export function MarketplaceSettingsPage() {
  const { t } = useTranslation("plugins");
  const [source, setSource] = useState("");
  const [refName, setRefName] = useState("");
  const [sparsePaths, setSparsePaths] = useState("");
  const [serverFormError, setServerFormError] = useState<string | null>(null);
  const [sourceRequired, setSourceRequired] = useState(false);
  const formError = sourceRequired ? t("marketplaceSourceIsRequired") : serverFormError;
  const config = useConfig();
  const plugins = usePluginList();
  const actions = useMarketplaceSettingsActions(config.data?.config);
  const upgradeMarketplace = useUpgradeMarketplace();
  const activeMarketplaces = plugins.data?.marketplaces ?? [];
  const activeMarketplaceNames = useMemo(
    () => new Set(activeMarketplaces.map((marketplace) => marketplace.name)),
    [activeMarketplaces],
  );
  const disabledMarketplaces = Object.entries(actions.marketplacePreferences.disabled).filter(
    ([name]) => !activeMarketplaceNames.has(name),
  );
  const isBusy =
    actions.pendingAction !== null ||
    actions.addMarketplace.isPending ||
    upgradeMarketplace.isPending ||
    actions.removeMarketplace.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSource = source.trim();
    if (!trimmedSource) {
      setSourceRequired(true);
      return;
    }

    setSourceRequired(false);
    setServerFormError(null);
    const parsedSparsePaths = sparsePaths
      .split(",")
      .map((path) => path.trim())
      .filter(Boolean);
    const definition = {
      source: trimmedSource,
      refName: refName.trim() || undefined,
      sparsePaths: parsedSparsePaths.length ? parsedSparsePaths : undefined,
    };

    try {
      await actions.add(definition);
      setSource("");
      setRefName("");
      setSparsePaths("");
    } catch (error) {
      setServerFormError(formatErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h2 className="text-3xl font-semibold tracking-tight">{t("pluginMarketplaces")}</h2>

      <SettingsPanel icon={PuzzlePieceIcon} title={t("addMarketplace")}>
        <form onSubmit={handleSubmit}>
          <div className="text-sm">
            <FormFieldRow compact label={t("source")} controlId="marketplace-source">
              <input
                aria-label={t("source")}
                id="marketplace-source"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder={t("httpsgithubcomexamplemarketplacegitOrPathtomarketplace")}
              />
            </FormFieldRow>
            <FormFieldRow compact label={t("gitRefOptional")} controlId="marketplace-ref">
              <input
                aria-label={t("gitRefOptional")}
                id="marketplace-ref"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={refName}
                onChange={(event) => setRefName(event.target.value)}
                placeholder="main"
              />
            </FormFieldRow>
            <FormFieldRow compact label={t("sparsePathsOptional")} controlId="marketplace-sparse-paths">
              <input
                aria-label={t("sparsePathsOptional")}
                id="marketplace-sparse-paths"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={sparsePaths}
                onChange={(event) => setSparsePaths(event.target.value)}
                placeholder="plugins/example, plugins/another"
              />
            </FormFieldRow>
          </div>
          {formError && <p className="px-5 pt-4 text-sm text-error">{formError}</p>}
          {actions.addMarketplace.isError && !formError && (
            <p className="px-5 pt-4 text-sm text-error">
              {t("unableToAddMarketplace", {
                details: formatErrorMessage(actions.addMarketplace.error),
              })}
            </p>
          )}
          <div className="flex justify-end px-5 py-4">
            <button
              aria-label={actions.addMarketplace.isPending ? t("adding") : t("addMarketplace")}
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={isBusy}
            >
              {actions.addMarketplace.isPending ? t("adding") : t("addMarketplace")}
            </button>
          </div>
        </form>
      </SettingsPanel>

      <SettingsPanel icon={PuzzlePieceIcon} title={t("configuredMarketplaces")}>
        {plugins.isLoading && (
          <div className="px-5 py-4">
            <span className="loading loading-spinner" />
          </div>
        )}
        {plugins.isError && (
          <p className="px-5 py-4 text-sm text-error">
            {t("unableToLoadMarketplaces", {
              details: formatErrorMessage(plugins.error),
            })}
          </p>
        )}
        {!plugins.isLoading && !plugins.isError && !activeMarketplaces.length && !disabledMarketplaces.length && (
          <p className="px-5 py-4 text-sm text-base-content/60">{t("noPluginMarketplacesConfigured")}</p>
        )}
        {activeMarketplaces.length ? (
          <ul className="divide-y divide-base-300 text-sm">
            {activeMarketplaces.map((marketplace) => {
              const displayName = marketplace.interface?.displayName ?? marketplace.name;
              const definition = actions.definitionForMarketplace(marketplace.name);
              const isPending = actions.pendingAction === marketplace.name;

              return (
                <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={marketplace.name}>
                  <div className="min-w-0">
                    <p className="font-medium">{displayName}</p>
                    <p className="text-xs text-base-content/60">
                      {marketplace.name} · {t("pluginCount", { count: marketplace.plugins.length })}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      aria-label={
                        upgradeMarketplace.isPending ? t("updating") : t("updateNamed", { name: marketplace.name })
                      }
                      className="btn btn-ghost btn-sm"
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void upgradeMarketplace.mutateAsync({
                          marketplaceName: marketplace.name,
                        })
                      }
                    >
                      {upgradeMarketplace.isPending ? t("updating") : t("updateNamed", { name: marketplace.name })}
                    </button>
                    {definition && (
                      <button
                        aria-label={isPending ? t("disabling") : t("disableNamed", { name: marketplace.name })}
                        className="btn btn-outline btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void actions.disable(marketplace.name, definition)}
                      >
                        {isPending ? t("disabling") : t("disableNamed", { name: marketplace.name })}
                      </button>
                    )}
                    <button
                      aria-label={t("removeNamed", { name: marketplace.name })}
                      className="btn btn-outline btn-error btn-sm"
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (globalThis.confirm(t("removeConfirm", { name: marketplace.name }))) {
                          void actions.removeMarketplace.mutateAsync({
                            marketplaceName: marketplace.name,
                          });
                        }
                      }}
                    >
                      {t("removeNamed", { name: marketplace.name })}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {disabledMarketplaces.length > 0 && (
          <div className="border-t border-base-300">
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-base-content/60">
              {t("disabledMarketplaces")}
            </div>
            <ul className="divide-y divide-base-300 text-sm">
              {disabledMarketplaces.map(([name, definition]) => {
                const isPending = actions.pendingAction === name;
                return (
                  <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-4" key={name}>
                    <div className="min-w-0">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-base-content/60">{t("disabled")}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        aria-label={isPending ? t("enabling") : t("enableNamed", { name: name })}
                        className="btn btn-primary btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void actions.enable(name, definition)}
                      >
                        {isPending ? t("enabling") : t("enableNamed", { name: name })}
                      </button>
                      <button
                        aria-label={t("forgetNamed", { name: name })}
                        className="btn btn-outline btn-error btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() => actions.forget(name)}
                      >
                        {t("forgetNamed", { name })}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {actions.actionError && (
          <p className="px-5 pt-4 text-sm text-error">
            {t("unableToChangeMarketplaceState", {
              details: actions.actionError,
            })}
          </p>
        )}
        {upgradeMarketplace.isError && (
          <p className="px-5 pt-4 text-sm text-error">
            {t("unableToUpdateMarketplace", {
              details: formatErrorMessage(upgradeMarketplace.error),
            })}
          </p>
        )}
        {actions.removeMarketplace.isError && (
          <p className="px-5 pt-4 text-sm text-error">
            {t("unableToRemoveMarketplace", {
              details: formatErrorMessage(actions.removeMarketplace.error),
            })}
          </p>
        )}
        {plugins.data?.marketplaceLoadErrors.length ? (
          <div className="space-y-1 px-5 pt-4 text-sm text-error">
            <p>
              {t("marketplaceLoadErrors", {
                count: plugins.data.marketplaceLoadErrors.length,
              })}
            </p>
            {plugins.data.marketplaceLoadErrors.map((loadError) => (
              <p className="text-xs" key={loadError.marketplacePath}>
                {loadError.marketplacePath}: {loadError.message}
              </p>
            ))}
          </div>
        ) : null}
      </SettingsPanel>
    </div>
  );
}
