export type MarketplaceDefinition = {
  source: string;
  refName?: string;
  sparsePaths?: string[];
};

export type MarketplacePreferences = {
  version: 1;
  disabled: Record<string, MarketplaceDefinition>;
};

export const MARKETPLACE_PREFERENCES_KEY = "ruxex.marketplace-preferences";

export const DEFAULT_MARKETPLACE_PREFERENCES: MarketplacePreferences = {
  version: 1,
  disabled: {},
};

export function parseMarketplacePreferences(
  raw: string | null,
): MarketplacePreferences {
  if (!raw) return DEFAULT_MARKETPLACE_PREFERENCES;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1) {
      return DEFAULT_MARKETPLACE_PREFERENCES;
    }

    const disabled: Record<string, MarketplaceDefinition> = {};
    if (isRecord(parsed.disabled)) {
      for (const [name, value] of Object.entries(parsed.disabled)) {
        const definition = parseMarketplaceDefinition(value);
        if (definition) disabled[name] = definition;
      }
    }

    return { version: 1, disabled };
  } catch {
    return DEFAULT_MARKETPLACE_PREFERENCES;
  }
}

export function readMarketplacePreferences(): MarketplacePreferences {
  if (typeof window === "undefined") return DEFAULT_MARKETPLACE_PREFERENCES;
  return parseMarketplacePreferences(
    window.localStorage.getItem(MARKETPLACE_PREFERENCES_KEY),
  );
}

export function writeMarketplacePreferences(
  preferences: MarketplacePreferences,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    MARKETPLACE_PREFERENCES_KEY,
    JSON.stringify(preferences),
  );
}

export function addDisabledMarketplace(
  preferences: MarketplacePreferences,
  name: string,
  definition: MarketplaceDefinition,
): MarketplacePreferences {
  return {
    version: 1,
    disabled: { ...preferences.disabled, [name]: definition },
  };
}

export function removeDisabledMarketplace(
  preferences: MarketplacePreferences,
  name: string,
): MarketplacePreferences {
  const { [name]: _removed, ...disabled } = preferences.disabled;
  return { version: 1, disabled };
}

function parseMarketplaceDefinition(
  value: unknown,
): MarketplaceDefinition | null {
  if (!isRecord(value) || typeof value.source !== "string") return null;

  const refName = typeof value.refName === "string" ? value.refName : undefined;
  const sparsePaths = Array.isArray(value.sparsePaths)
    ? value.sparsePaths.filter(
        (path): path is string => typeof path === "string",
      )
    : undefined;

  return { source: value.source, refName, sparsePaths };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
