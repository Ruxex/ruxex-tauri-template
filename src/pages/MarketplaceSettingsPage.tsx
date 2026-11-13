import { PuzzlePieceIcon } from "@heroicons/react/24/outline";
import { type FormEvent, useMemo, useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import {
  useConfig,
  usePluginList,
  useUpgradeMarketplace,
} from "../app-server/hooks";
import { SettingsPanel } from "../components/settings/SettingsCards";
import { FormFieldRow } from "../components/common/FormFieldRow";
import { useMarketplaceSettingsActions } from "./useMarketplaceSettingsActions";

export function MarketplaceSettingsPage() {
  const [source, setSource] = useState("");
  const [refName, setRefName] = useState("");
  const [sparsePaths, setSparsePaths] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const config = useConfig();
  const plugins = usePluginList();
  const actions = useMarketplaceSettingsActions(config.data?.config);
  const upgradeMarketplace = useUpgradeMarketplace();
  const activeMarketplaces = plugins.data?.marketplaces ?? [];
  const activeMarketplaceNames = useMemo(
    () => new Set(activeMarketplaces.map((marketplace) => marketplace.name)),
    [activeMarketplaces],
  );
  const disabledMarketplaces = Object.entries(
    actions.marketplacePreferences.disabled,
  ).filter(([name]) => !activeMarketplaceNames.has(name));
  const isBusy =
    actions.pendingAction !== null ||
    actions.addMarketplace.isPending ||
    upgradeMarketplace.isPending ||
    actions.removeMarketplace.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSource = source.trim();
    if (!trimmedSource) {
      setFormError("Marketplace source is required.");
      return;
    }

    setFormError(null);
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
      setFormError(formatErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <h2 className="text-3xl font-semibold tracking-tight">
        Plugin marketplaces
      </h2>

      <SettingsPanel icon={PuzzlePieceIcon} title="Add marketplace">
        <form onSubmit={handleSubmit}>
          <div className="text-sm">
            <FormFieldRow compact label="Source" controlId="marketplace-source">
              <input
                aria-label="Source"
                id="marketplace-source"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="https://github.com/example/marketplace.git or /path/to/marketplace"
              />
            </FormFieldRow>
            <FormFieldRow
              compact
              label="Git ref (optional)"
              controlId="marketplace-ref"
            >
              <input
                aria-label="Git ref (optional)"
                id="marketplace-ref"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={refName}
                onChange={(event) => setRefName(event.target.value)}
                placeholder="main"
              />
            </FormFieldRow>
            <FormFieldRow
              compact
              label="Sparse paths (optional)"
              controlId="marketplace-sparse-paths"
            >
              <input
                aria-label="Sparse paths (optional)"
                id="marketplace-sparse-paths"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={sparsePaths}
                onChange={(event) => setSparsePaths(event.target.value)}
                placeholder="plugins/example, plugins/another"
              />
            </FormFieldRow>
          </div>
          {formError && (
            <p className="px-5 pt-4 text-sm text-error">{formError}</p>
          )}
          {actions.addMarketplace.isError && !formError && (
            <p className="px-5 pt-4 text-sm text-error">
              Unable to add marketplace:{" "}
              {formatErrorMessage(actions.addMarketplace.error)}
            </p>
          )}
          <div className="flex justify-end px-5 py-4">
            <button
              aria-label={
                actions.addMarketplace.isPending ? "Adding…" : "Add marketplace"
              }
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={isBusy}
            >
              {actions.addMarketplace.isPending ? "Adding…" : "Add marketplace"}
            </button>
          </div>
        </form>
      </SettingsPanel>

      <SettingsPanel icon={PuzzlePieceIcon} title="Configured marketplaces">
        {plugins.isLoading && (
          <div className="px-5 py-4">
            <span className="loading loading-spinner" />
          </div>
        )}
        {plugins.isError && (
          <p className="px-5 py-4 text-sm text-error">
            Unable to load marketplaces: {formatErrorMessage(plugins.error)}
          </p>
        )}
        {!plugins.isLoading &&
          !plugins.isError &&
          !activeMarketplaces.length &&
          !disabledMarketplaces.length && (
            <p className="px-5 py-4 text-sm text-base-content/60">
              No plugin marketplaces configured.
            </p>
          )}
        {activeMarketplaces.length ? (
          <ul className="divide-y divide-base-300 text-sm">
            {activeMarketplaces.map((marketplace) => {
              const displayName =
                marketplace.interface?.displayName ?? marketplace.name;
              const definition = actions.definitionForMarketplace(
                marketplace.name,
              );
              const isPending = actions.pendingAction === marketplace.name;

              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  key={marketplace.name}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{displayName}</p>
                    <p className="text-xs text-base-content/60">
                      {marketplace.name} · {marketplace.plugins.length} plugins
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      aria-label={
                        upgradeMarketplace.isPending
                          ? "Updating…"
                          : `Update ${marketplace.name}`
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
                      {upgradeMarketplace.isPending
                        ? "Updating…"
                        : `Update ${marketplace.name}`}
                    </button>
                    {definition && (
                      <button
                        aria-label={
                          isPending
                            ? "Disabling…"
                            : `Disable ${marketplace.name}`
                        }
                        className="btn btn-outline btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void actions.disable(marketplace.name, definition)
                        }
                      >
                        {isPending
                          ? "Disabling…"
                          : `Disable ${marketplace.name}`}
                      </button>
                    )}
                    <button
                      aria-label={`Remove ${marketplace.name}`}
                      className="btn btn-outline btn-error btn-sm"
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (globalThis.confirm(`Remove ${marketplace.name}?`)) {
                          void actions.removeMarketplace.mutateAsync({
                            marketplaceName: marketplace.name,
                          });
                        }
                      }}
                    >
                      Remove {marketplace.name}
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
              Disabled marketplaces
            </div>
            <ul className="divide-y divide-base-300 text-sm">
              {disabledMarketplaces.map(([name, definition]) => {
                const isPending = actions.pendingAction === name;
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                    key={name}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{name}</p>
                      <p className="text-xs text-base-content/60">Disabled</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        aria-label={isPending ? "Enabling…" : `Enable ${name}`}
                        className="btn btn-primary btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void actions.enable(name, definition)}
                      >
                        {isPending ? "Enabling…" : `Enable ${name}`}
                      </button>
                      <button
                        aria-label={`Forget ${name}`}
                        className="btn btn-outline btn-error btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() => actions.forget(name)}
                      >
                        Forget {name}
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
            Unable to change marketplace state: {actions.actionError}
          </p>
        )}
        {upgradeMarketplace.isError && (
          <p className="px-5 pt-4 text-sm text-error">
            Unable to update marketplace:{" "}
            {formatErrorMessage(upgradeMarketplace.error)}
          </p>
        )}
        {actions.removeMarketplace.isError && (
          <p className="px-5 pt-4 text-sm text-error">
            Unable to remove marketplace:{" "}
            {formatErrorMessage(actions.removeMarketplace.error)}
          </p>
        )}
        {plugins.data?.marketplaceLoadErrors.length ? (
          <div className="space-y-1 px-5 pt-4 text-sm text-error">
            <p>
              {plugins.data.marketplaceLoadErrors.length} marketplace load
              errors
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
