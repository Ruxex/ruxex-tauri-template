import type { Story } from "@ladle/react";

import { ArtifactPreview } from "./ArtifactPreview";

const preview = {
  mimeType: "image/svg+xml" as const,
  dataUrl:
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='120'><rect width='100%' height='100%' fill='%23ffffff'/><text x='16' y='32' font-family='sans-serif' font-size='18'>Report preview</text><rect x='16' y='48' width='220' height='28' fill='%23f1f5f9'/><text x='24' y='68' font-family='sans-serif'>Ada</text><text x='180' y='68' font-family='sans-serif'>3</text></svg>",
  format: "xlsx" as const,
  sheets: 1,
  rows: 3,
  columns: 2,
  byteSize: 128,
  pages: [],
  diagnostics: [],
};

export const GeneratedWorkbook: Story = () => (
  <ArtifactPreview
    loadPreview={async () => preview}
    path="/workspace/report.xlsx"
  />
);
