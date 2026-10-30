import { PuzzlePieceIcon } from "@heroicons/react/24/outline";
import { type FormEvent, type ReactNode, useMemo, useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import {
  addDisabledMarketplace,
  readMarketplacePreferences,
  removeDisabledMarketplace,
  writeMarketplacePreferences,
  type MarketplaceDefinition,
} from "../app/marketplace-preferences";
import {
  useAddMarketplace,
  useConfig,
  usePluginList,
  useRemoveMarketplace,
  useUpgradeMarketplace,
} from "../app-server/hooks";
import { SettingsPanel } from "../components/settings/SettingsCards";

export function MarketplaceSettingsPage() {
  const [source, setSource] = useState("");
  const [refName, setRefName] = useState("");
  const [sparsePaths, setSparsePaths] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [marketplacePreferences, setMarketplacePreferences] = useState(
    readMarketplacePreferences,
  );
  const [recentDefinitions, setRecentDefinitions] = useState<
    Record<string, MarketplaceDefinition>
  >({});
  const config = useConfig();
  const plugins = usePluginList();
  const addMarketplace = useAddMarketplace();
  const upgradeMarketplace = useUpgradeMarketplace();
  const removeMarketplace = useRemoveMarketplace();
  const activeMarketplaces = plugins.data?.marketplaces ?? [];
  const activeMarketplaceNames = useMemo(
    () => new Set(activeMarketplaces.map((marketplace) => marketplace.name)),
    [activeMarketplaces],
  );
  const disabledMarketplaces = Object.entries(
    marketplacePreferences.disabled,
  ).filter(([name]) => !activeMarketplaceNames.has(name));
  const isBusy =
    pendingAction !== null ||
    addMarketplace.isPending ||
    upgradeMarketplace.isPending ||
    removeMarketplace.isPending;

  function updateMarketplacePreferences(next: typeof marketplacePreferences) {
    setMarketplacePreferences(next);
    writeMarketplacePreferences(next);
  }

  function definitionForMarketplace(
    marketplaceName: string,
  ): MarketplaceDefinition | null {
    return (
      recentDefinitions[marketplaceName] ??
      readMarketplaceDefinition(config.data?.config, marketplaceName)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSource = source.trim();
    if (!trimmedSource) {
      setFormError("Marketplace source is required.");
      return;
    }

    setFormError(null);
    setActionError(null);
    const parsedSparsePaths = sparsePaths
      .split(",")
      .map((path) => path.trim())
      .filter(Boolean);
    const definition: MarketplaceDefinition = {
      source: trimmedSource,
      refName: refName.trim() || undefined,
      sparsePaths: parsedSparsePaths.length ? parsedSparsePaths : undefined,
    };

    try {
      const response = await addMarketplace.mutateAsync({
        source: definition.source,
        refName: definition.refName,
        sparsePaths: definition.sparsePaths,
      });
      if (response?.marketplaceName) {
        setRecentDefinitions((current) => ({
          ...current,
          [response.marketplaceName]: definition,
        }));
        updateMarketplacePreferences(
          removeDisabledMarketplace(
            marketplacePreferences,
            response.marketplaceName,
          ),
        );
      }
      setSource("");
      setRefName("");
      setSparsePaths("");
    } catch (error) {
      setFormError(formatErrorMessage(error));
    }
  }

  async function handleDisable(
    marketplaceName: string,
    definition: MarketplaceDefinition,
  ) {
    const previous = marketplacePreferences;
    setActionError(null);
    setPendingAction(marketplaceName);
    updateMarketplacePreferences(
      addDisabledMarketplace(previous, marketplaceName, definition),
    );
    try {
      await removeMarketplace.mutateAsync({ marketplaceName });
    } catch (error) {
      updateMarketplacePreferences(previous);
      setActionError(formatErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleEnable(
    marketplaceName: string,
    definition: MarketplaceDefinition,
  ) {
    setActionError(null);
    setPendingAction(marketplaceName);
    try {
      await addMarketplace.mutateAsync({
        source: definition.source,
        refName: definition.refName,
        sparsePaths: definition.sparsePaths,
      });
      updateMarketplacePreferences(
        removeDisabledMarketplace(marketplacePreferences, marketplaceName),
      );
    } catch (error) {
      setActionError(formatErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  function handleForget(marketplaceName: string) {
    updateMarketplacePreferences(
      removeDisabledMarketplace(marketplacePreferences, marketplaceName),
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <h2 className="text-3xl font-semibold tracking-tight">
        Plugin marketplaces
      </h2>

      <SettingsPanel icon={PuzzlePieceIcon} title="Add marketplace">
        <form onSubmit={handleSubmit}>
          <div className="divide-y divide-base-300 text-sm">
            <MarketplaceFieldRow label="Source" controlId="marketplace-source">
              <input
                id="marketplace-source"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="https://github.com/example/marketplace.git or /path/to/marketplace"
              />
            </MarketplaceFieldRow>
            <MarketplaceFieldRow
              label="Git ref (optional)"
              controlId="marketplace-ref"
            >
              <input
                id="marketplace-ref"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={refName}
                onChange={(event) => setRefName(event.target.value)}
                placeholder="main"
              />
            </MarketplaceFieldRow>
            <MarketplaceFieldRow
              label="Sparse paths (optional)"
              controlId="marketplace-sparse-paths"
            >
              <input
                id="marketplace-sparse-paths"
                className="input input-bordered input-sm w-full max-w-sm justify-self-end max-sm:max-w-none"
                value={sparsePaths}
                onChange={(event) => setSparsePaths(event.target.value)}
                placeholder="plugins/example, plugins/another"
              />
            </MarketplaceFieldRow>
          </div>
          {formError && (
            <p className="px-5 pt-4 text-sm text-error">{formError}</p>
          )}
          {addMarketplace.isError && !formError && (
            <p className="px-5 pt-4 text-sm text-error">
              Unable to add marketplace:{" "}
              {formatErrorMessage(addMarketplace.error)}
            </p>
          )}
          <div className="flex justify-end px-5 py-4">
            <button
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={isBusy}
            >
              {addMarketplace.isPending ? "Adding…" : "Add marketplace"}
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
              const definition = definitionForMarketplace(marketplace.name);
              const isPending = pendingAction === marketplace.name;

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
                        className="btn btn-outline btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleDisable(marketplace.name, definition)
                        }
                      >
                        {isPending
                          ? "Disabling…"
                          : `Disable ${marketplace.name}`}
                      </button>
                    )}
                    <button
                      className="btn btn-outline btn-error btn-sm"
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (globalThis.confirm(`Remove ${marketplace.name}?`)) {
                          void removeMarketplace.mutateAsync({
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
                const isPending = pendingAction === name;
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
                        className="btn btn-primary btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleEnable(name, definition)}
                      >
                        {isPending ? "Enabling…" : `Enable ${name}`}
                      </button>
                      <button
                        className="btn btn-outline btn-error btn-sm"
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleForget(name)}
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
        {actionError && (
          <p className="px-5 pt-4 text-sm text-error">
            Unable to change marketplace state: {actionError}
          </p>
        )}
        {upgradeMarketplace.isError && (
          <p className="px-5 pt-4 text-sm text-error">
            Unable to update marketplace:{" "}
            {formatErrorMessage(upgradeMarketplace.error)}
          </p>
        )}
        {removeMarketplace.isError && (
          <p className="px-5 pt-4 text-sm text-error">
            Unable to remove marketplace:{" "}
            {formatErrorMessage(removeMarketplace.error)}
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

function readMarketplaceDefinition(
  config: unknown,
  marketplaceName: string,
): MarketplaceDefinition | null {
  if (!isRecord(config) || !isRecord(config.marketplaces)) return null;
  const entry = config.marketplaces[marketplaceName];
  if (!isRecord(entry) || typeof entry.source !== "string") return null;

  const refName =
    typeof entry.refName === "string"
      ? entry.refName
      : typeof entry.ref === "string"
        ? entry.ref
        : undefined;
  const sparsePathsValue = entry.sparsePaths ?? entry.sparse_paths;
  const sparsePaths = Array.isArray(sparsePathsValue)
    ? sparsePathsValue.filter(
        (path): path is string => typeof path === "string",
      )
    : undefined;

  return { source: entry.source, refName, sparsePaths };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function MarketplaceFieldRow({
  label,
  controlId,
  children,
}: {
  label: string;
  controlId: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,40%)] items-center gap-4 px-5 py-3.5 max-sm:grid-cols-1 max-sm:items-start">
      <label className="label-text" htmlFor={controlId}>
        {label}
      </label>
      {children}
    </div>
  );
}
