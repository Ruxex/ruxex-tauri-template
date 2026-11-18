import { useTranslation } from "react-i18next";
import { useState } from "react";

import { useMcpOauthLogin } from "@/app-server/hooks";
import type { v2 } from "@/protocol";
import { openBrowserWindow } from "@/platform/native";

export function McpOAuthLoginAction({
  name,
  authStatus,
  runtimeStatus,
  available = false,
}: {
  name: string;
  authStatus?: v2.McpServerStatus["authStatus"];
  runtimeStatus?: v2.McpServerStatus["runtimeStatus"];
  available?: boolean;
}) {
  const { t } = useTranslation("mcp");
  const oauthLogin = useMcpOauthLogin();
  const [error, setError] = useState<
    { key: "oauthAuthorizationUrlIsInvalid" | "unableToStartMcpLogin" } | { details: string } | null
  >(null);
  const canLogin =
    available || runtimeStatus === "authenticationRequired" || authStatus === "notLoggedIn" || authStatus === "oAuth";

  if (!canLogin) return null;

  async function connectMcpServer() {
    setError(null);
    try {
      const response = await oauthLogin.mutateAsync({ name });
      let authorizationUrl: URL;
      try {
        authorizationUrl = new URL(response.authorizationUrl);
      } catch {
        setError({ key: "oauthAuthorizationUrlIsInvalid" });
        return;
      }
      if (authorizationUrl.protocol !== "https:" && authorizationUrl.protocol !== "http:") {
        setError({ key: "oauthAuthorizationUrlIsInvalid" });
        return;
      }
      await openBrowserWindow(response.authorizationUrl);
    } catch (loginError) {
      setError(loginError instanceof Error ? { details: loginError.message } : { key: "unableToStartMcpLogin" });
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        aria-label={oauthLogin.isPending ? t("startingLogin") : t("authenticateNamed", { name: name })}
        className="btn btn-outline btn-xs"
        disabled={oauthLogin.isPending}
        onClick={() => void connectMcpServer()}
        type="button"
      >
        {oauthLogin.isPending ? t("startingLogin") : t("authenticate")}
      </button>
      {error && (
        <span className="text-error" role="alert">
          {"key" in error ? t(error.key) : error.details}
        </span>
      )}
    </span>
  );
}
