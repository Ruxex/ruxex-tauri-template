import type { Story } from "@ladle/react";
import { CapabilitiesCard } from "./CapabilitiesCard";

export default { title: "Feature / Settings / Capabilities Card" };

export const MixedSupport: Story = () => (
  <div className="max-w-4xl p-4">
    <CapabilitiesCard
      capabilities={{
        modelListing: true,
        streaming: true,
        webSearch: false,
        interactiveLogin: "Unsupported",
      }}
    />
  </div>
);
