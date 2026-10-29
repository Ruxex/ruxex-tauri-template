import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
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

  if (pathname.startsWith("/settings/")) {
    const section = pathname.split("/")[2];
    const labels: Record<string, string> = {
      account: "Account",
      appearance: "Appearance",
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
    return [
      { label: "Projects", to: "/projects" },
      { label: projectTitle },
    ];
  }

  if (pathname === "/projects") {
    return [{ label: "Projects" }];
  }

  const pageLabels: Record<string, string> = {
    "/approvals": "Approvals",
    "/archive": "Archive",
    "/capabilities": "Plugins",
    "/login": "Login",
    "/schedules": "Automation",
    "/threads": "Threads",
  };

  return [{ label: pageLabels[pathname] ?? "Page" }];
}

export function BrowserNavigationBar({
  chatTitle,
  projectTitle,
}: {
  chatTitle?: string;
  projectTitle?: string;
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

  return (
    <nav
      aria-label="Browser navigation"
      className="flex h-8 shrink-0 items-center border-b border-base-300/60 bg-base-200/70 px-3 text-base-content/60 sm:px-4"
    >
      <div className="flex items-center gap-0.5">
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
      </div>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 px-2">
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
    </nav>
  );
}
