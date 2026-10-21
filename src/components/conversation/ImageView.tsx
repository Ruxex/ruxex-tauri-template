import { useEffect, useState } from "react";

import { readImageFile } from "../../platform/native";

type ImageViewProps = {
  path?: string;
  url?: string;
};

export function ImageView({ path, url }: ImageViewProps) {
  const [source, setSource] = useState<string | null>(url ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    setSource(url ?? null);

    if (path) {
      setSource(null);
      void readImageFile(path)
        .then((dataUrl) => {
          if (active) {
            setSource(dataUrl);
          }
        })
        .catch((reason: unknown) => {
          if (active) {
            setError(reason instanceof Error ? reason.message : String(reason));
          }
        });
    } else if (!url || !isAllowedImageUrl(url)) {
      setError("This image source is not allowed.");
    }

    return () => {
      active = false;
    };
  }, [path, url]);

  if (error) {
    return <p className="text-sm text-error">{error}</p>;
  }
  if (!source) {
    return (
      <span
        aria-label="Loading image"
        className="loading loading-spinner"
        role="status"
      />
    );
  }

  return (
    <figure className="my-3 overflow-hidden rounded-box border border-base-300 bg-base-200">
      <img
        alt="Screenshot from the App Server"
        className="max-h-96 max-w-full object-contain"
        src={source}
      />
    </figure>
  );
}

function isAllowedImageUrl(value: string): boolean {
  return value.startsWith("data:image/") || value.startsWith("https://");
}
