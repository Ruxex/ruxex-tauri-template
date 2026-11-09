import type { Story } from "@ladle/react";

import { ArtifactViewer } from "./ArtifactViewer";

const preview = {
  mimeType: "image/svg+xml" as const,
  dataUrl:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='180'><rect width='100%' height='100%' fill='%23ffffff'/><text x='16' y='32' font-family='sans-serif' font-size='18'>Page 1</text><text x='16' y='70' font-family='sans-serif'>Quarterly review</text></svg>",
  format: "pdf" as const,
  sheets: 2,
  rows: 4,
  columns: 1,
  byteSize: 512,
  diagnostics: ["One embedded asset is preview-only"],
  pages: [
    {
      label: "Page 1",
      dataUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='180'><rect width='100%' height='100%' fill='%23ffffff'/><text x='16' y='32' font-family='sans-serif' font-size='18'>Page 1</text><text x='16' y='70' font-family='sans-serif'>Quarterly review</text></svg>",
      width: 480,
      height: 180,
      diagnostics: [],
    },
    {
      label: "Page 2",
      dataUrl:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='180'><rect width='100%' height='100%' fill='%23ffffff'/><text x='16' y='32' font-family='sans-serif' font-size='18'>Page 2</text></svg>",
      width: 480,
      height: 180,
      diagnostics: ["Image preview unavailable"],
    },
  ],
};

export const PagedPdf: Story = () => <ArtifactViewer preview={preview} />;
