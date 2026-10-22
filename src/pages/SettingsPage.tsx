import { Outlet } from "react-router-dom";

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}
