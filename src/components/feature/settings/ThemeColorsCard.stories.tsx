import type { Story } from "@ladle/react";
import { ThemeColorsCard } from "./ThemeColorsCard";

export const PrimaryColor: Story = () => (
  <div className="max-w-3xl p-4">
    <ThemeColorsCard colors={{ primary: "oklch(57% 0.22 255)" }} onColorChange={() => undefined} />
  </div>
);
