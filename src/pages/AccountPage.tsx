import { Link } from "react-router-dom";

import { formatErrorMessage } from "../app/error-message";
import { useAccount, useLogout } from "../app-server/hooks";
import {
  SettingRow,
  SettingsPanel,
} from "../components/settings/SettingsCards";
import { StateBadge } from "../components/common/StateBadge";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export function AccountPage() {
  const account = useAccount();
  const logout = useLogout();

  if (account.isLoading) {
    return <span className="loading loading-spinner loading-lg" />;
  }

  if (account.isError) {
    return (
      <p className="alert alert-error">{formatErrorMessage(account.error)}</p>
    );
  }

  const data = account.data;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Account
        </p>
      </div>
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
            {data?.account?.type ?? "Not signed in"}
          </SettingRow>
        </dl>
        {data?.authStatus === "authenticated" ? (
          <div className="flex justify-end px-5 py-4">
            <button
              className="btn btn-outline"
              disabled={logout.isPending}
              type="button"
              onClick={() => logout.mutate()}
            >
              {logout.isPending ? "Logging out…" : "Log out"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end px-5 py-4">
            <Link className="btn btn-primary" to="/login">
              Log in
            </Link>
          </div>
        )}
        {logout.isError && (
          <p className="px-5 pb-4 text-sm text-error" role="alert">
            Unable to log out: {formatErrorMessage(logout.error)}
          </p>
        )}
      </SettingsPanel>
    </div>
  );
}
