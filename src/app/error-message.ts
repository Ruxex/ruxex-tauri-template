import { i18n } from "./i18n";

const appErrorCodes = [
  "pluginLocalMarketplaceRequired",
  "imageReadFailed",
  "audioReadFailed",
  "mcpResourceSelectionRequired",
  "marketplaceImageSourceNotAllowed",
  "marketplaceImagePathNotAllowed",
] as const;
export type AppUiErrorCode = (typeof appErrorCodes)[number];

/** Stable codes belong to Ruxex; arbitrary server messages stay verbatim. */
export class AppUiError extends Error {
  constructor(readonly code: AppUiErrorCode) {
    super(i18n.t(code, { ns: "errors", lng: "en" }));
    this.name = "AppUiError";
  }
}

export function formatErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    appErrorCodes.some((code) => code === error.code)
  ) {
    return i18n.t(error.code as AppUiErrorCode, {
      ns: "errors",
      lng: i18n.resolvedLanguage,
    });
  }
  if (error instanceof Error) {
    return String(error);
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return i18n.t("unableToDisplay", {
        ns: "errors",
        lng: i18n.resolvedLanguage,
      });
    }
  }
  return String(error);
}
