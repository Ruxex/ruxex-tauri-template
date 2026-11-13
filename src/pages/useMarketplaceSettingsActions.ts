import { useState } from "react";

import { formatErrorMessage } from "../app/error-message";
import {
  addDisabledMarketplace,
  readMarketplaceDefinition,
  readMarketplacePreferences,
  removeDisabledMarketplace,
  writeMarketplacePreferences,
  type MarketplaceDefinition,
} from "../app/marketplace-preferences";
import { useAddMarketplace, useRemoveMarketplace } from "../app-server/hooks";

export function useMarketplaceSettingsActions(config: unknown) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [marketplacePreferences, setMarketplacePreferences] = useState(
    readMarketplacePreferences,
  );
  const [recentDefinitions, setRecentDefinitions] = useState<
    Record<string, MarketplaceDefinition>
  >({});
  const addMarketplace = useAddMarketplace();
  const removeMarketplace = useRemoveMarketplace();

  function updatePreferences(next: typeof marketplacePreferences) {
    setMarketplacePreferences(next);
    writeMarketplacePreferences(next);
  }

  function definitionForMarketplace(name: string) {
    return recentDefinitions[name] ?? readMarketplaceDefinition(config, name);
  }

  async function add(definition: MarketplaceDefinition) {
    setActionError(null);
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
      updatePreferences(
        removeDisabledMarketplace(
          marketplacePreferences,
          response.marketplaceName,
        ),
      );
    }
  }

  async function disable(name: string, definition: MarketplaceDefinition) {
    const previous = marketplacePreferences;
    setActionError(null);
    setPendingAction(name);
    updatePreferences(addDisabledMarketplace(previous, name, definition));
    try {
      await removeMarketplace.mutateAsync({ marketplaceName: name });
    } catch (error) {
      updatePreferences(previous);
      setActionError(formatErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function enable(name: string, definition: MarketplaceDefinition) {
    setActionError(null);
    setPendingAction(name);
    try {
      await addMarketplace.mutateAsync({
        source: definition.source,
        refName: definition.refName,
        sparsePaths: definition.sparsePaths,
      });
      updatePreferences(
        removeDisabledMarketplace(marketplacePreferences, name),
      );
    } catch (error) {
      setActionError(formatErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  function forget(name: string) {
    updatePreferences(removeDisabledMarketplace(marketplacePreferences, name));
  }

  return {
    actionError,
    add,
    addMarketplace,
    definitionForMarketplace,
    disable,
    enable,
    forget,
    marketplacePreferences,
    pendingAction,
    removeMarketplace,
  };
}
