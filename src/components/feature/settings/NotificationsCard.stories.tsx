import type { Story } from "@ladle/react";
import { NotificationsCard } from "./NotificationsCard";

export const Enabled: Story = () => (
  <div className="max-w-3xl p-4">
    <NotificationsCard enabled sound="system" onEnabledChange={() => undefined} onSoundChange={() => undefined} />
  </div>
);
