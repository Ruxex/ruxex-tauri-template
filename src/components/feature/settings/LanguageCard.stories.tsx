import type { Story } from "@ladle/react";
import { LanguageCard } from "./LanguageCard";

export default { title: "Feature / Settings / Language Card" };

export const Japanese: Story = () => (
  <div className="max-w-3xl p-4">
    <LanguageCard language="ja" onLanguageChange={() => undefined} />
  </div>
);
