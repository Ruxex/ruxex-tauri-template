import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

import { formatErrorMessage } from "../../app/error-message";
import { readImageFile } from "../../platform/native";

type ImageViewProps = {
  path?: string;
  url?: string;
};

export function ImageView({ path, url }: ImageViewProps) {
  const { t } = useTranslation("conversation");

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
            setError(
              reason instanceof Error
                ? reason.message
                : formatErrorMessage(reason),
            );
          }
        });
    }

    return () => {
      active = false;
    };
  }, [path, url]);

  if (!path && (!url || !isAllowedImageUrl(url))) {
    return (
      <p className="text-sm text-error">{t("thisImageSourceIsNotAllowed")}</p>
    );
  }
  if (error) {
    return <p className="text-sm text-error">{error}</p>;
  }
  if (!source) {
    return (
      <span
        aria-label={t("loadingImage")}
        className="loading loading-spinner"
        role="status"
      />
    );
  }

  return (
    <figure className="my-3 overflow-hidden rounded-box border border-base-300 bg-base-200">
      <img
        alt={t("screenshotFromTheAppServer")}
        className="max-h-96 max-w-full object-contain"
        src={source}
      />
    </figure>
  );
}

function isAllowedImageUrl(value: string): boolean {
  return value.startsWith("data:image/") || value.startsWith("https://");
}
