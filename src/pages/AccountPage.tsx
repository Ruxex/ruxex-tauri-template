import { Link } from "react-router-dom";

import { useAccount } from "../app-server/hooks";
import {
  SettingRow,
  SettingsPanel,
} from "../components/settings/SettingsCards";

export function AccountPage() {
  const account = useAccount();

  if (account.isLoading) {
    return <span className="loading loading-spinner loading-lg" />;
  }

  if (account.isError) {
    return <p className="alert alert-error">{String(account.error)}</p>;
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
            {data?.authStatus === "authenticated"
              ? "Authenticated"
              : "Authentication required"}
          </SettingRow>
          <SettingRow label="Account type">
            {data?.account?.type ?? "Not signed in"}
          </SettingRow>
        </dl>
        {data?.authStatus !== "authenticated" && (
          <div className="flex justify-end px-5 py-4">
            <Link className="btn btn-primary" to="/login">
              Log in
            </Link>
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}
