import { Link, useNavigate } from "react-router-dom";

import {
  useAccount,
  useAppServerEvents,
  useAppServerStatus,
  useLogout,
} from "../../app-server/hooks";

function useConnectionLabel() {
  const appServer = useAppServerStatus();
  const events = useAppServerEvents();

  const label = appServer.isError
    ? "Error"
    : !appServer.isSuccess
      ? "Local"
      : events.connected
        ? "Connected"
        : "Disconnected";

  return label;
}

type TopBarProps = {
  contextDrawerOpen: boolean;
  onToggleContext: () => void;
  onToggleSidebar: () => void;
};

export function TopBar({
  contextDrawerOpen,
  onToggleContext,
  onToggleSidebar,
}: TopBarProps) {
  const navigate = useNavigate();
  const account = useAccount();
  const logout = useLogout();
  const connectionLabel = useConnectionLabel();

  return (
    <div className="navbar flex-wrap gap-2 border-b border-base-300 bg-base-100 px-4 sm:px-6">
      <button
        className="btn btn-ghost btn-sm xl:hidden"
        type="button"
        aria-label="Toggle project sidebar"
        onClick={onToggleSidebar}
      >
        ☰
      </button>
      <div className="flex min-w-0 flex-1">
        <Link className="text-xl font-semibold" to="/">
          Workspace
        </Link>
      </div>
      <div className="badge badge-outline gap-2">
        <span
          className={`status ${connectionLabel === "Connected" ? "status-success" : "status-warning"}`}
          aria-hidden="true"
        />
        {connectionLabel}
      </div>
      <button
        className={`btn btn-ghost btn-sm ${contextDrawerOpen ? "btn-active" : ""}`}
        type="button"
        onClick={onToggleContext}
        aria-pressed={contextDrawerOpen}
      >
        Context
      </button>
      {account.data?.account && (
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={logout.isPending}
          onClick={() => {
            void logout
              .mutateAsync()
              .then(() => navigate("/login"))
              .catch(() => undefined);
          }}
        >
          {logout.isPending ? "Logging out…" : "Log out"}
        </button>
      )}
    </div>
  );
}
