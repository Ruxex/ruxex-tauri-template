import type { Story } from "@ladle/react";
import { QuickPanelCard } from "./QuickPanelCard";

export default { title: "Feature / Settings / Quick Panel Card" };

export const Configured: Story = () => (
  <div className="max-w-3xl p-4">
    <QuickPanelCard
      defaultShortcut="Ctrl+Shift+Space"
      shortcut="Ctrl+Shift+Space"
      disabled={false}
      isLoading={false}
      waylandNotice="Global shortcuts may require desktop permissions."
      onReset={() => undefined}
      onSave={() => undefined}
      onShortcutKeyDown={() => undefined}
    />
  </div>
);
