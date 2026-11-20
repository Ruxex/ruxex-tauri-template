import type { Story } from "@ladle/react";

import { BrowserComputerUseCard } from "./BrowserComputerUseCard";

export default { title: "Composite / Capabilities / Browser Computer Use Card" };

export const Available: Story = () => (
  <BrowserComputerUseCard
    config={{ browser_use: {}, computer_use: {} }}
    requirements={{
      allowBrowserAndComputerUse: true,
      browserUse: {},
      computerUse: {},
    }}
  />
);

export const DisabledByPolicy: Story = () => (
  <BrowserComputerUseCard
    config={{ browser_use: {}, computer_use: {} }}
    requirements={{ allowBrowserAndComputerUse: false }}
  />
);
