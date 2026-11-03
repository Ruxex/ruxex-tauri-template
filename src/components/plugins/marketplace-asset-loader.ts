import {
  readLocalMarketplaceAsset,
  readMarketplaceAsset,
} from "../../platform/native";
import { validateMarketplaceAssetUrl } from "./marketplace-asset-policy";

const assetCache = new Map<string, Promise<string>>();
const localAssetCache = new Map<string, Promise<string>>();

export async function loadMarketplaceAsset(value: string): Promise<string> {
  const requestedUrl = validateMarketplaceAssetUrl(value);
  if (!requestedUrl) {
    throw new Error("This marketplace image source is not allowed.");
  }

  const cacheKey = requestedUrl.toString();
  const cached = assetCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = readMarketplaceAsset(cacheKey).catch((error: unknown) => {
    assetCache.delete(cacheKey);
    throw error;
  });
  assetCache.set(cacheKey, pending);
  return pending;
}

export async function loadLocalMarketplaceAsset(path: string): Promise<string> {
  if (!path) {
    throw new Error("This marketplace image path is not allowed.");
  }

  const cached = localAssetCache.get(path);
  if (cached) {
    return cached;
  }

  const pending = readLocalMarketplaceAsset(path).catch((error: unknown) => {
    localAssetCache.delete(path);
    throw error;
  });
  localAssetCache.set(path, pending);
  return pending;
}

export function clearMarketplaceAssetCacheForTests(): void {
  assetCache.clear();
  localAssetCache.clear();
}
