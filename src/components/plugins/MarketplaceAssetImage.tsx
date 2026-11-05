import { useEffect, useState } from "react";
import { PhotoIcon } from "@heroicons/react/24/outline";

import {
  loadLocalMarketplaceAsset,
  loadMarketplaceAsset,
} from "./marketplace-asset-loader";

type MarketplaceAssetImageProps = {
  alt: string;
  className?: string;
  localDarkSrc?: string | null;
  localSrc?: string | null;
  darkSrc?: string | null;
  src?: string | null;
};

function loadPreferredMarketplaceAsset(
  localPath: string | null | undefined,
  remoteUrl: string | null | undefined,
): Promise<string | null> {
  if (localPath) {
    return loadLocalMarketplaceAsset(localPath).catch(() =>
      remoteUrl ? loadMarketplaceAsset(remoteUrl) : null,
    );
  }
  return remoteUrl ? loadMarketplaceAsset(remoteUrl) : Promise.resolve(null);
}

export function MarketplaceAssetImage({
  alt,
  className,
  localDarkSrc,
  localSrc,
  darkSrc,
  src,
}: MarketplaceAssetImageProps) {
  const [lightSource, setLightSource] = useState<string | null>(null);
  const [darkSource, setDarkSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLightSource(null);
    setDarkSource(null);
    setIsLoading(true);

    if (!localSrc && !localDarkSrc && !src && !darkSrc) {
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    void Promise.allSettled([
      loadPreferredMarketplaceAsset(localSrc, src),
      loadPreferredMarketplaceAsset(localDarkSrc, darkSrc),
    ]).then(([lightResult, darkResult]) => {
      if (!active) {
        return;
      }

      const light =
        lightResult.status === "fulfilled" ? lightResult.value : null;
      const dark = darkResult.status === "fulfilled" ? darkResult.value : null;
      setLightSource(light);
      setDarkSource(dark);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [darkSrc, localDarkSrc, localSrc, src]);

  if (isLoading) {
    return (
      <span
        aria-label="Loading plugin image"
        className="loading loading-spinner loading-sm"
        role="status"
      />
    );
  }

  const imageSource = lightSource ?? darkSource;
  if (!imageSource) {
    return (
      <span
        aria-label="Plugin image unavailable"
        className="inline-flex size-full items-center justify-center text-base-content/40"
        role="img"
      >
        <PhotoIcon aria-hidden="true" className="size-5" />
      </span>
    );
  }

  return (
    <picture>
      {darkSource && (
        <source media="(prefers-color-scheme: dark)" srcSet={darkSource} />
      )}
      <img alt={alt} className={className} src={imageSource} />
    </picture>
  );
}
