import { i18n } from "../../app/i18n";
import { useTranslation } from "react-i18next";
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
  chatTitle = i18n.t("navigation:conversation"),
  projectTitle = i18n.t("navigation:project"),
  chatProjectId?: string,
): Breadcrumb[] {
  if (pathname === "/") {
    return [{ label: i18n.t("navigation:home") }];
  }

  if (pathname === "/settings") {
    return [
      { label: i18n.t("navigation:settings"), to: "/settings" },
      { label: i18n.t("navigation:general") },
    ];
  }

  if (pathname === "/settings/account") {
    return [{ label: i18n.t("navigation:account") }];
  }

  if (pathname.startsWith("/settings/")) {
    const section = pathname.split("/")[2];
    const labels: Record<string, string> = {
      account: i18n.t("navigation:account"),
      appearance: i18n.t("navigation:appearance"),
      archive: i18n.t("navigation:archivedChats"),
      "app-server": i18n.t("navigation:appServer"),
      hooks: i18n.t("navigation:hooks"),
      marketplaces: i18n.t("navigation:pluginMarketplaces"),
      "mcp-servers": i18n.t("navigation:mcpServers"),
      models: i18n.t("navigation:models"),
      provider: i18n.t("navigation:provider"),
      version: i18n.t("navigation:version"),
    };

    return [
      { label: i18n.t("navigation:settings"), to: "/settings" },
      { label: labels[section] ?? i18n.t("navigation:settings") },
    ];
  }

  if (pathname.startsWith("/chat/")) {
    if (chatProjectId) {
      return [
        { label: i18n.t("navigation:projects"), to: "/projects" },
        {
          label: projectTitle,
          to: `/projects/${encodeURIComponent(chatProjectId)}`,
        },
        { label: chatTitle },
      ];
    }

    return [
      { label: i18n.t("navigation:chats"), to: "/chats" },
      { label: chatTitle },
    ];
  }

  if (pathname.startsWith("/projects/")) {
    return [
      { label: i18n.t("navigation:projects"), to: "/projects" },
      { label: projectTitle },
    ];
  }

  if (pathname === "/projects") {
    return [{ label: i18n.t("navigation:projects") }];
  }

  if (pathname.startsWith("/capabilities/plugins/")) {
    const pluginName =
      pathname.split("/").at(-1) ?? i18n.t("navigation:plugin");
    let label = pluginName;
    try {
      label = decodeURIComponent(pluginName);
    } catch {
      // Keep the route segment as-is when it is not valid URI encoding.
    }
    return [
      { label: i18n.t("navigation:plugins"), to: "/capabilities/plugins" },
      { label },
    ];
  }

  if (pathname === "/capabilities/plugins") {
    return [{ label: i18n.t("navigation:plugins") }];
  }

  if (pathname === "/capabilities/skills") {
    return [{ label: i18n.t("navigation:skills") }];
  }

  const pageLabels: Record<string, string> = {
    "/activity": i18n.t("navigation:activity"),
    "/approvals": i18n.t("navigation:approvals"),
    "/archive": i18n.t("navigation:archive"),
    "/schedules": i18n.t("navigation:automation"),
  };

  return [{ label: pageLabels[pathname] ?? i18n.t("navigation:page") }];
}

export function BrowserNavigationBar({
  chatTitle,
  chatProjectId,
  projectTitle,
  onToggleSidebar,
  sidebarOpen = true,
  onToggleRightPane,
  rightPaneOpen = false,
}: {
  chatTitle?: string;
  chatProjectId?: string;
  projectTitle?: string;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
  onToggleRightPane?: () => void;
  rightPaneOpen?: boolean;
}) {
  const { t } = useTranslation("navigation");
  const navigate = useNavigate();
  const location = useLocation();
  const historyIndex =
    typeof window === "undefined" ? undefined : window.history.state?.idx;
  const canGoBack = historyIndex === undefined || historyIndex > 0;
  const breadcrumbs = breadcrumbsForPath(
    location.pathname,
    chatTitle,
    projectTitle,
    chatProjectId,
  );
  const SidebarToggleIcon = sidebarOpen
    ? ArrowLeftStartOnRectangleIcon
    : ArrowRightStartOnRectangleIcon;
  const RightPaneToggleIcon = rightPaneOpen
    ? ArrowRightStartOnRectangleIcon
    : ArrowLeftStartOnRectangleIcon;

  return (
    <nav
      aria-label={t("navigation:browserNavigation")}
      className="flex h-8 shrink-0 items-center border-b border-base-300/60 bg-base-200/70 text-base-content/60"
    >
      <div
        className={`flex shrink-0 items-center gap-0.5 border-r border-base-300/60 ${sidebarOpen ? "w-[320px] px-3 sm:px-4" : "w-auto px-1.5"}`}
      >
        <button
          aria-label={t("navigation:back")}
          className="btn btn-ghost btn-xs btn-square"
          disabled={!canGoBack}
          onClick={() => navigate(-1)}
          title={t("navigation:back")}
          type="button"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-3.5" />
        </button>
        <button
          aria-label={t("navigation:forward")}
          className="btn btn-ghost btn-xs btn-square"
          onClick={() => navigate(1)}
          title={t("navigation:forward")}
          type="button"
        >
          <ChevronRightIcon aria-hidden="true" className="size-3.5" />
        </button>
        {onToggleSidebar && (
          <button
            aria-label={
              sidebarOpen
                ? t("navigation:closeSidebar")
                : t("navigation:openSidebar")
            }
            aria-pressed={sidebarOpen}
            className="btn btn-ghost btn-xs btn-square"
            onClick={onToggleSidebar}
            title={
              sidebarOpen
                ? t("navigation:closeSidebar")
                : t("navigation:openSidebar")
            }
            type="button"
          >
            <SidebarToggleIcon aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
      <nav
        aria-label={t("navigation:breadcrumb")}
        className={`min-w-0 flex-1 ${sidebarOpen ? "px-3 sm:px-4" : "pl-0 pr-3 sm:pr-4"}`}
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
          aria-label={
            rightPaneOpen
              ? t("navigation:closeRightPane")
              : t("navigation:openRightPane")
          }
          aria-pressed={rightPaneOpen}
          className="btn btn-ghost btn-xs btn-square mx-3 sm:mx-4"
          onClick={onToggleRightPane}
          title={
            rightPaneOpen
              ? t("navigation:closeRightPane")
              : t("navigation:openRightPane")
          }
          type="button"
        >
          <RightPaneToggleIcon aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </nav>
  );
}
