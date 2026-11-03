const MARKETPLACE_ASSET_HOSTS = new Set([
  "github.com",
  "raw.githubusercontent.com",
]);

export function validateMarketplaceAssetUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    !MARKETPLACE_ASSET_HOSTS.has(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.pathname.includes("%") ||
    url.pathname.includes("\\")
  ) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (
    segments.length < 4 ||
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        segment.split("").some((character) => {
          const code = character.charCodeAt(0);
          return code < 0x20 || code === 0x7f;
        }),
    )
  ) {
    return null;
  }

  return url;
}
