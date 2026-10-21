import { Outlet } from "react-router-dom";

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Workspace
        </p>
        <h1 className="text-3xl font-semibold">Settings</h1>
      </div>
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
