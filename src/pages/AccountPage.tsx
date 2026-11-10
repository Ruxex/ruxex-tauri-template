import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { formatErrorMessage } from "../app/error-message";
import { useAccount, useLogin, useLogout } from "../app-server/hooks";
import { PasswordInput } from "../components/common/PasswordInput";
import { StateBadge } from "../components/common/StateBadge";
import {
  SettingRow,
  SettingsPanel,
} from "../components/settings/SettingsCards";

export function AccountPage() {
  const account = useAccount();
  const login = useLogin();
  const logout = useLogout();
  const [apiKey, setApiKey] = useState("");

  if (account.isLoading) {
    return <span className="loading loading-spinner loading-lg" />;
  }

  if (account.isError) {
    return (
      <p className="alert alert-error">{formatErrorMessage(account.error)}</p>
    );
  }

  const data = account.data;

  if (data?.authStatus !== "authenticated") {
    return (
      <div className="space-y-5">
        <SettingsPanel title="Sign in">
          <form
            className="space-y-5 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleLogin();
            }}
          >
            <PasswordInput
              autoComplete="current-password"
              id="account-api-key"
              label="API key"
              placeholder="Enter your API key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              required
            />
            {login.isError && (
              <p className="text-error">{formatErrorMessage(login.error)}</p>
            )}
            <div className="flex justify-end">
              <button
                aria-label={login.isPending ? "Logging in…" : "Log in"}
                className="btn btn-primary"
                type="submit"
                disabled={login.isPending}
              >
                {login.isPending ? "Logging in…" : "Log in"}
              </button>
            </div>
          </form>
        </SettingsPanel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsPanel title="Account information">
        <dl className="divide-y divide-base-300 text-sm">
          <SettingRow label="Status">
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
                ? "Authenticated"
                : "Authentication required"}
            </StateBadge>
          </SettingRow>
          <SettingRow label="Account type">
            {formatAccountType(data?.account?.type)}
          </SettingRow>
        </dl>
        <div className="flex justify-end px-5 py-4">
          <button
            aria-label={logout.isPending ? "Logging out…" : "Log out"}
            className="btn btn-outline"
            disabled={logout.isPending}
            type="button"
            onClick={() => logout.mutate()}
          >
            {logout.isPending ? "Logging out…" : "Log out"}
          </button>
        </div>
        {logout.isError && (
          <p className="px-5 pb-4 text-sm text-error" role="alert">
            Unable to log out: {formatErrorMessage(logout.error)}
          </p>
        )}
      </SettingsPanel>
    </div>
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

function formatAccountType(type: string | undefined): string {
  if (!type) return "Not signed in";
  if (type === "apiKey") return "API key";
  return type;
}
