import type { Story } from "@ladle/react";

import { MarketplaceAssetImage } from "./MarketplaceAssetImage";

export const Unavailable: Story = () => (
  <div className="size-16 rounded-box border border-base-300 bg-base-200">
    <MarketplaceAssetImage alt="Example plugin" />
  </div>
);
