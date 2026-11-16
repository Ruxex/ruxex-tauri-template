import { i18n } from "../app/i18n";
import { useTranslation } from "react-i18next";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { type ReactNode, useState } from "react";
import { formatErrorMessage } from "../app/error-message";
import { useAccount, useLogin, useLogout } from "../app-server/hooks";
import { PasswordInput } from "../components/common/PasswordInput";
import { StateBadge } from "../components/common/StateBadge";
import {
  SettingRow,
  SettingsPanel,
} from "../components/settings/SettingsCards";

export function AccountPage() {
  const { t } = useTranslation("settings");
  const account = useAccount();
  const login = useLogin();
  const logout = useLogout();
  const [apiKey, setApiKey] = useState("");

  if (account.isLoading) {
    return (
      <AccountPageLayout>
        <span className="loading loading-spinner loading-lg" />
      </AccountPageLayout>
    );
  }

  if (account.isError) {
    return (
      <AccountPageLayout>
        <p className="alert alert-error">{formatErrorMessage(account.error)}</p>
      </AccountPageLayout>
    );
  }

  const data = account.data;

  if (data?.authStatus !== "authenticated") {
    return (
      <AccountPageLayout>
        <SettingsPanel title={t("settings:signIn")}>
          <form
            className="grid gap-5 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <PasswordInput
              autoComplete="current-password"
              hideLabel
              id="account-api-key"
              label={t("settings:apiKey")}
              placeholder={t("settings:apiKeyPlaceholder")}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              required
            />
            {login.isError && (
              <p className="text-error">{formatErrorMessage(login.error)}</p>
            )}
            <div className="flex justify-end">
              <button
                aria-label={
                  login.isPending
                    ? t("settings:loggingIn")
                    : t("settings:logIn")
                }
                className="btn btn-primary"
                type="submit"
                disabled={login.isPending}
              >
                {login.isPending
                  ? t("settings:loggingIn")
                  : t("settings:logIn")}
              </button>
            </div>
          </form>
        </SettingsPanel>
      </AccountPageLayout>
    );
  }

  return (
    <AccountPageLayout>
      <SettingsPanel title={t("settings:information")}>
        <dl className="divide-y divide-base-300 text-sm">
          <SettingRow label={t("settings:status")}>
            <StateBadge
              icon={
                data?.authStatus === "authenticated"
                  ? CheckCircleIcon
                  : ExclamationTriangleIcon
              }
              tone={
                data?.authStatus === "authenticated" ? "success" : "warning"
              }
            >
              {data?.authStatus === "authenticated"
                ? t("settings:authenticated")
                : t("settings:authenticationRequired")}
            </StateBadge>
          </SettingRow>
          <SettingRow label={t("settings:accountType")}>
            {formatAccountType(data?.account?.type)}
          </SettingRow>
        </dl>
        <div className="flex justify-end px-5 py-4">
          <button
            aria-label={
              logout.isPending ? t("settings:loggingOut") : t("settings:logOut")
            }
            className="btn btn-outline"
            disabled={logout.isPending}
            type="button"
            onClick={() => logout.mutate()}
          >
            {logout.isPending ? t("settings:loggingOut") : t("settings:logOut")}
          </button>
        </div>
        {logout.isError && (
          <p className="px-5 pb-4 text-sm text-error" role="alert">
            {t("settings:logoutError", {
              error: formatErrorMessage(logout.error),
            })}
          </p>
        )}
      </SettingsPanel>
    </AccountPageLayout>
  );

  async function handleLogin() {
    try {
      await login.mutateAsync({ type: "apiKey", apiKey });
      await account.refetch();
    } catch {
      // The mutation state renders the error next to the form.
    }
  }
}

function AccountPageLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation("settings");
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h2 className="text-3xl font-semibold tracking-tight">
        {t("settings:account")}
      </h2>
      {children}
    </div>
  );
}

function formatAccountType(type: string | undefined): string {
  if (!type) return i18n.t("settings:notSignedIn");
  if (type === "apiKey") return i18n.t("settings:apiKey");
  return type;
}
