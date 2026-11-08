import type { Story } from "@ladle/react";

import { SlashCommandPalette } from "./SlashCommandPalette";

export const Enabled: Story = () => (
  <SlashCommandPalette disabled={false} onSelect={() => undefined} />
);

export const Disabled: Story = () => (
  <SlashCommandPalette disabled onSelect={() => undefined} />
);
