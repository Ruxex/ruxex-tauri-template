import type { Story } from "@ladle/react";

import { ImageView } from "./ImageView";

const imageDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='96'%3E%3Crect width='160' height='96' fill='%233b82f6'/%3E%3C/svg%3E";

export const DataImage: Story = () => <ImageView url={imageDataUrl} />;

export const DisallowedSource: Story = () => (
  <ImageView url="http://example.invalid/image.png" />
);
