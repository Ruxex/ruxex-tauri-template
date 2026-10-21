import { NavLink, Outlet } from "react-router-dom";

const SETTINGS_TABS = [
  { label: "General", to: "/settings", end: true },
  { label: "Account", to: "/settings/account", end: false },
] as const;

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Workspace
        </p>
        <h1 className="text-3xl font-semibold">Settings</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div
          aria-label="Settings sections"
          className="tabs tabs-boxed h-fit items-stretch gap-1 lg:flex-col"
          role="tablist"
        >
          {SETTINGS_TABS.map((tab) => (
            <NavLink
              className={({ isActive }) =>
                `tab justify-start ${isActive ? "tab-active" : ""}`
              }
              end={tab.end}
              key={tab.to}
              role="tab"
              to={tab.to}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
