import type { Story } from "@ladle/react";

import { McpResourceViewer } from "./McpResourceViewer";

const textResponse = {
  contents: [
    {
      uri: "resource://catalog/config.json",
      mimeType: "application/json",
      text: '{"enabled":true,"mode":"catalog"}',
    },
  ],
} as never;

const blobResponse = {
  contents: [
    {
      uri: "resource://catalog/image.bin",
      mimeType: "application/octet-stream",
      blob: "Y2F0YWxvZw==",
    },
  ],
} as never;

export const Text: Story = () => <McpResourceViewer response={textResponse} />;

export const Binary: Story = () => (
  <McpResourceViewer response={blobResponse} />
);

export const Loading: Story = () => <McpResourceViewer isLoading />;

export const ResourceError: Story = () => (
  <McpResourceViewer error={new Error("Resource unavailable")} />
);
