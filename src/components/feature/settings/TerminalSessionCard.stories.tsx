import type { Story } from "@ladle/react";

export default { title: "Feature / Settings / Terminal Session Card" };

export const DesktopRuntimeRequired: Story = () => (
  <div className="max-w-3xl rounded-box border border-base-300 bg-base-100 p-5 text-sm text-base-content/70">
    Terminal session timeout controls are available in the desktop runtime.
  </div>
);
