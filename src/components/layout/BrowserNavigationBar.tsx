import {
  ArrowLeftStartOnRectangleIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { Link, useLocation, useNavigate } from "react-router-dom";

type Breadcrumb = {
  label: string;
  to?: string;
};

function breadcrumbsForPath(
  pathname: string,
  chatTitle = "Conversation",
  projectTitle = "Project",
): Breadcrumb[] {
  if (pathname === "/") {
    return [{ label: "Home" }];
  }

  if (pathname === "/settings") {
    return [{ label: "Settings", to: "/settings" }, { label: "General" }];
  }

  if (pathname === "/settings/account") {
    return [{ label: "Account" }];
  }

  if (pathname.startsWith("/settings/")) {
    const section = pathname.split("/")[2];
    const labels: Record<string, string> = {
      account: "Account",
      appearance: "Appearance",
      archive: "Archived chats",
      "app-server": "App Server",
      hooks: "Hooks",
      marketplaces: "Plugin marketplaces",
      "mcp-servers": "MCP servers",
      models: "Models",
    };

    return [
      { label: "Settings", to: "/settings" },
      { label: labels[section] ?? "Settings" },
    ];
  }

  if (pathname.startsWith("/chat/")) {
    return [{ label: chatTitle }];
  }

  if (pathname.startsWith("/projects/")) {
    return [{ label: "Projects", to: "/projects" }, { label: projectTitle }];
  }

  if (pathname === "/projects") {
    return [{ label: "Projects" }];
  }

  if (pathname.startsWith("/capabilities/plugins/")) {
    const pluginName = pathname.split("/").at(-1) ?? "Plugin";
    let label = pluginName;
    try {
      label = decodeURIComponent(pluginName);
    } catch {
      // Keep the route segment as-is when it is not valid URI encoding.
    }
    return [{ label: "Plugins", to: "/capabilities/plugins" }, { label }];
  }

  if (pathname === "/capabilities/plugins") {
    return [{ label: "Plugins" }];
  }

  if (pathname === "/capabilities/skills") {
    return [{ label: "Skills" }];
  }

  if (pathname === "/capabilities/mcp") {
    return [{ label: "MCP" }];
  }

  const pageLabels: Record<string, string> = {
    "/activity": "Activity",
    "/approvals": "Approvals",
    "/archive": "Archive",
    "/schedules": "Automation",
  };

  return [{ label: pageLabels[pathname] ?? "Page" }];
}

export function BrowserNavigationBar({
  chatTitle,
  projectTitle,
  onToggleSidebar,
  sidebarOpen = true,
  onToggleRightPane,
  rightPaneOpen = false,
}: {
  chatTitle?: string;
  projectTitle?: string;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onToggleRightPane?: () => void;
  rightPaneOpen?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const historyIndex =
    typeof window === "undefined" ? undefined : window.history.state?.idx;
  const canGoBack = historyIndex === undefined || historyIndex > 0;
  const breadcrumbs = breadcrumbsForPath(
    location.pathname,
    chatTitle,
    projectTitle,
  );
  const SidebarToggleIcon = sidebarOpen
    ? ArrowLeftStartOnRectangleIcon
    : ArrowRightStartOnRectangleIcon;
  const RightPaneToggleIcon = rightPaneOpen
    ? ArrowRightStartOnRectangleIcon
    : ArrowLeftStartOnRectangleIcon;

  return (
    <nav
      aria-label="Browser navigation"
      className="flex h-8 shrink-0 items-center border-b border-base-300/60 bg-base-200/70 text-base-content/60"
    >
      <div className="flex w-[320px] shrink-0 items-center gap-0.5 border-r border-base-300/60 px-3 sm:px-4">
        <button
          aria-label="Back"
          className="btn btn-ghost btn-xs btn-square"
          disabled={!canGoBack}
          onClick={() => navigate(-1)}
          title="Back"
          type="button"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-3.5" />
        </button>
        <button
          aria-label="Forward"
          className="btn btn-ghost btn-xs btn-square"
          onClick={() => navigate(1)}
          title="Forward"
          type="button"
        >
          <ChevronRightIcon aria-hidden="true" className="size-3.5" />
        </button>
        {onToggleSidebar && (
          <button
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-pressed={sidebarOpen}
            className="btn btn-ghost btn-xs btn-square"
            onClick={onToggleSidebar}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            type="button"
          >
            <SidebarToggleIcon aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
      <nav
        aria-label="Breadcrumb"
        className="min-w-0 flex-1 px-3 sm:px-4"
      >
        <ol className="flex min-w-0 items-center gap-1 text-xs">
          {breadcrumbs.map((breadcrumb, index) => (
            <li
              className="flex min-w-0 items-center gap-1"
              key={`${breadcrumb.to ?? "current"}-${breadcrumb.label}`}
            >
              {index > 0 && (
                <ChevronRightIcon
                  aria-hidden="true"
                  className="size-3 shrink-0 opacity-50"
                />
              )}
              {breadcrumb.to ? (
                <Link
                  className="truncate hover:text-base-content"
                  to={breadcrumb.to}
                >
                  {breadcrumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate">
                  {breadcrumb.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {onToggleRightPane && (
        <button
          aria-label={rightPaneOpen ? "Close right pane" : "Open right pane"}
          aria-pressed={rightPaneOpen}
          className="btn btn-ghost btn-xs btn-square mx-3 sm:mx-4"
          onClick={onToggleRightPane}
          title={rightPaneOpen ? "Close right pane" : "Open right pane"}
          type="button"
        >
          <RightPaneToggleIcon aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </nav>
  );
}
