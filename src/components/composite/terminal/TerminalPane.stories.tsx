import type { Story } from "@ladle/react";

export default { title: "Composite / Terminal / Terminal Pane" };

export const DesktopRuntimeRequired: Story = () => (
  <section
    aria-label="Terminal"
    className="flex h-72 items-center justify-center rounded-box bg-neutral p-4 text-sm text-neutral-content"
  >
    Terminal sessions require the desktop runtime.
  </section>
);
