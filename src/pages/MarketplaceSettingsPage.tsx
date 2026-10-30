import { type FormEvent, useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import {
  useAddMarketplace,
  usePluginList,
  useRemoveMarketplace,
  useUpgradeMarketplace,
} from "../app-server/hooks";

export function MarketplaceSettingsPage() {
  const [source, setSource] = useState("");
  const [refName, setRefName] = useState("");
  const [sparsePaths, setSparsePaths] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const plugins = usePluginList();
  const addMarketplace = useAddMarketplace();
  const upgradeMarketplace = useUpgradeMarketplace();
  const removeMarketplace = useRemoveMarketplace();

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
    try {
      await addMarketplace.mutateAsync({
        source: trimmedSource,
        refName: refName.trim() || undefined,
        sparsePaths: parsedSparsePaths.length ? parsedSparsePaths : undefined,
      });
      setSource("");
      setRefName("");
      setSparsePaths("");
    } catch (error) {
      setFormError(formatErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Plugin marketplaces</h2>
      </div>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-lg">Add marketplace</h3>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="form-control w-full">
              <span className="label-text">Source</span>
              <input
                className="input input-bordered w-full"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="https://github.com/example/marketplace.git or /path/to/marketplace"
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text">Git ref (optional)</span>
              <input
                className="input input-bordered w-full"
                value={refName}
                onChange={(event) => setRefName(event.target.value)}
                placeholder="main"
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text">Sparse paths (optional)</span>
              <input
                className="input input-bordered w-full"
                value={sparsePaths}
                onChange={(event) => setSparsePaths(event.target.value)}
                placeholder="plugins/example, plugins/another"
              />
            </label>
            {formError && <p className="text-sm text-error">{formError}</p>}
            {addMarketplace.isError && !formError && (
              <p className="text-sm text-error">
                Unable to add marketplace:{" "}
                {formatErrorMessage(addMarketplace.error)}
              </p>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={addMarketplace.isPending}
            >
              {addMarketplace.isPending ? "Adding…" : "Add marketplace"}
            </button>
          </form>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-lg">Configured marketplaces</h3>
          {plugins.isLoading && <span className="loading loading-spinner" />}
          {plugins.isError && (
            <p className="text-error">
              Unable to load marketplaces: {formatErrorMessage(plugins.error)}
            </p>
          )}
          {!plugins.isLoading &&
            !plugins.isError &&
            !plugins.data?.marketplaces.length && (
              <p className="text-sm text-base-content/60">
                No plugin marketplaces configured.
              </p>
            )}
          <ul className="space-y-3">
            {plugins.data?.marketplaces.map((marketplace) => {
              const displayName =
                marketplace.interface?.displayName ?? marketplace.name;

              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-3 rounded-box bg-base-200 p-3"
                  key={marketplace.name}
                >
                  <div>
                    <p className="font-medium">{displayName}</p>
                    <p className="text-xs text-base-content/60">
                      {marketplace.name} · {marketplace.plugins.length} plugins
                    </p>
                  </div>
                  <div className="flex gap-2">
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
                      Update {marketplace.name}
                    </button>
                    <button
                      className="btn btn-outline btn-error btn-xs"
                      type="button"
                      disabled={removeMarketplace.isPending}
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
          {upgradeMarketplace.isError && (
            <p className="text-sm text-error">
              Unable to update marketplace:{" "}
              {formatErrorMessage(upgradeMarketplace.error)}
            </p>
          )}
          {removeMarketplace.isError && (
            <p className="text-sm text-error">
              Unable to remove marketplace:{" "}
              {formatErrorMessage(removeMarketplace.error)}
            </p>
          )}
          {plugins.data?.marketplaceLoadErrors.length ? (
            <p className="text-sm text-error">
              {plugins.data.marketplaceLoadErrors.length} marketplace load
              errors
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
